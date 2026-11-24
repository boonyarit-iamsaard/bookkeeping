import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  createOwner,
  TRANSACTIONS_URL,
} from "../../testing/transaction-route-fixture.js";
import { transactionCollectionResponseSchema } from "./transaction.schemas.js";

const { withRollback } = setupTestDatabase();

describe("GET /v1/transactions by page number", () => {
  test("returns a numbered, sorted page of the filtered list with its total", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      function expense(amount: bigint, recordedAt: string) {
        return insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount,
          transactionDate: "2026-09-02",
          recordedAt: new Date(recordedAt),
        });
      }
      const small = await expense(1_000n, "2026-09-02T01:00:00.000Z");
      const largeEarlier = await expense(9_000n, "2026-09-02T02:00:00.000Z");
      const largeLater = await expense(9_000n, "2026-09-02T03:00:00.000Z");
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        amount: 50_000n,
        transactionDate: "2026-09-03",
      });
      async function list(query: string) {
        const response = await app.request(`${TRANSACTIONS_URL}?${query}`, {
          headers: { origin: TEST_CLIENT_ORIGIN, cookie: owner.cookie },
        });
        expect(response.status).toBe(200);
        const body = transactionCollectionResponseSchema.parse(
          await response.json(),
        );
        return { ids: body.items.map((item) => item.id), page: body.page };
      }

      expect(
        await list("type=expense&sort=amount&order=desc&pageSize=10"),
      ).toEqual({
        ids: [largeLater, largeEarlier, small],
        page: { nextCursor: null, number: 1, size: 10, total: 3 },
      });
      expect((await list("type=expense&sort=amount&order=asc")).ids).toEqual([
        small,
        largeEarlier,
        largeLater,
      ]);
      expect(
        await list("type=expense&sort=amount&order=asc&page=2&pageSize=10"),
      ).toEqual({
        ids: [],
        page: { nextCursor: null, number: 2, size: 10, total: 3 },
      });
      expect((await list("type=expense&order=asc")).ids).toEqual([
        small,
        largeEarlier,
        largeLater,
      ]);
      expect((await list("type=expense&order=desc")).ids).toEqual([
        largeLater,
        largeEarlier,
        small,
      ]);
      expect((await list("page=1")).page).toEqual({
        nextCursor: null,
        number: 1,
        size: 50,
        total: 4,
      });
    });
  });

  test("rejects an out-of-range page or page size, an unknown sort, and a numbered cursor", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      for (const query of [
        "page=0",
        "page=-1",
        "page=1.5",
        "page=99999999999999999999",
        "pageSize=20",
        "pageSize=0",
        "sort=category",
        "order=up",
        "page=2&limit=10",
        "sort=amount&cursor=opaque",
      ]) {
        await expectProblem(
          await app.request(`${TRANSACTIONS_URL}?${query}`, {
            headers: { origin: TEST_CLIENT_ORIGIN, cookie: owner.cookie },
          }),
          { status: 400, code: "bad-request" },
        );
      }
    });
  });
});
