import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { listCategories } from "@bookkeeping/application/categories/reads";
import { createTagForTest } from "@bookkeeping/application/testing/tag-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import {
  expectFieldErrors,
  expectProblem,
} from "../../testing/expect-problem.js";
import {
  transactionCollectionResponseSchema,
  transactionResponseSchema,
} from "./transaction.routes.js";

const { withRollback } = setupTestDatabase();

const TRANSACTIONS_URL = `${TEST_API_ORIGIN}/v1/transactions`;

interface TaggingOwner {
  cookie: string;
  walletId: string;
  categoryId: string;
  coffeeId: string;
  shopId: string;
}

/** A signed-in owner with a cash wallet, the default trees, and two tags. */
async function createTaggingOwner(db: Database): Promise<TaggingOwner> {
  const { cookie, ownerId } = await createOwnerSession(db);
  await initializeDefaultCategories(db, ownerId);
  const wallet = await createWalletForTest(db, { ownerId });
  const category = (await listCategories(db, ownerId)).find(
    (candidate) => candidate.kind === "expense",
  );
  if (!category) {
    throw new Error("Missing default expense category");
  }
  return {
    cookie,
    walletId: wallet.id,
    categoryId: category.id,
    coffeeId: await createTagForTest(db, { ownerId, name: "Coffee" }),
    shopId: await createTagForTest(db, { ownerId, name: "Shop" }),
  };
}

interface TransactionRequest {
  method?: string;
  path?: string;
  cookie: string;
  idempotencyKey?: string;
  body?: unknown;
}

function request(
  app: Readonly<Hono<AppEnv>>,
  {
    method = "GET",
    path = "",
    cookie,
    idempotencyKey,
    body,
  }: Readonly<TransactionRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}${path}`, {
    method,
    headers: {
      cookie,
      origin: TEST_CLIENT_ORIGIN,
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function expenseBody(owner: Readonly<TaggingOwner>, tagIds?: string[]) {
  return {
    type: "expense",
    amount: { value: "45.00", currency: "THB" },
    walletId: owner.walletId,
    categoryId: owner.categoryId,
    transactionDate: "2026-09-02",
    note: "",
    ...(tagIds === undefined ? {} : { tagIds }),
  };
}

describe("transaction tags over HTTP", () => {
  test("an expense created and corrected with tags answers them by name", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createTaggingOwner(db);

      const created = await request(app, {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: "tagged-expense",
        body: expenseBody(owner, [owner.shopId, owner.coffeeId]),
      });

      expect(created.status).toBe(201);
      const expense = transactionResponseSchema.parse(await created.json());
      expect(expense.tags).toEqual([
        { id: owner.coffeeId, name: "Coffee" },
        { id: owner.shopId, name: "Shop" },
      ]);
      const { type: _type, ...correction } = expenseBody(owner, [owner.shopId]);
      const corrected = await request(app, {
        method: "PUT",
        path: `/${expense.id}`,
        cookie: owner.cookie,
        body: correction,
      });
      expect(corrected.status).toBe(200);
      expect(
        transactionResponseSchema.parse(await corrected.json()).tags,
      ).toEqual([{ id: owner.shopId, name: "Shop" }]);
    });
  });

  test("an edit must name its tags: an empty list removes them, none at all is refused", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createTaggingOwner(db);
      const expense = transactionResponseSchema.parse(
        await (
          await request(app, {
            method: "POST",
            cookie: owner.cookie,
            idempotencyKey: "edit-tags",
            body: expenseBody(owner, [owner.coffeeId]),
          })
        ).json(),
      );
      const { type: _type, ...correction } = expenseBody(owner);

      const unnamed = await request(app, {
        method: "PUT",
        path: `/${expense.id}`,
        cookie: owner.cookie,
        body: correction,
      });
      const cleared = await request(app, {
        method: "PUT",
        path: `/${expense.id}`,
        cookie: owner.cookie,
        body: { ...correction, tagIds: [] },
      });

      expect(await expectFieldErrors(unnamed)).toEqual([
        { pointer: "#/tagIds", code: "invalid-type" },
      ]);
      expect(cleared.status).toBe(200);
      expect(
        transactionResponseSchema.parse(await cleared.json()).tags,
      ).toEqual([]);
    });
  });

  test("maps tag rejections and malformed tag ids to the tag list", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createTaggingOwner(db);

      const unknown = await request(app, {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: "unknown-tag",
        body: expenseBody(owner, ["01999999-0000-7000-8000-000000000000"]),
      });
      const malformed = await request(app, {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: "malformed-tag",
        body: expenseBody(owner, ["not-a-tag"]),
      });

      expect(await expectFieldErrors(unknown)).toEqual([
        { pointer: "#/tagIds", code: "tag-not-found" },
      ]);
      expect(await expectFieldErrors(malformed)).toEqual([
        expect.objectContaining({ pointer: "#/tagIds/0" }),
      ]);
    });
  });

  test("filters by repeated tag ids, and refuses a malformed one", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createTaggingOwner(db);
      for (const [key, tagIds] of [
        ["coffee", [owner.coffeeId]],
        ["shop", [owner.shopId]],
        ["untagged", []],
      ] as const) {
        await request(app, {
          method: "POST",
          cookie: owner.cookie,
          idempotencyKey: key,
          body: expenseBody(owner, [...tagIds]),
        });
      }

      const both = await request(app, {
        path: `?tagId=${owner.coffeeId}&tagId=${owner.shopId}`,
        cookie: owner.cookie,
      });
      const one = await request(app, {
        path: `?tagId=${owner.coffeeId}`,
        cookie: owner.cookie,
      });

      expect(both.status).toBe(200);
      expect(
        transactionCollectionResponseSchema.parse(await both.json()).items,
      ).toHaveLength(2);
      expect(
        transactionCollectionResponseSchema
          .parse(await one.json())
          .items.map((item) => item.tags),
      ).toEqual([[{ id: owner.coffeeId, name: "Coffee" }]]);
      await expectProblem(
        await request(app, { path: "?tagId=not-a-tag", cookie: owner.cookie }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});
