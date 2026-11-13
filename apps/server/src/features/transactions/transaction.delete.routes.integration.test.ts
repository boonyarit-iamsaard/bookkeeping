import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  createOwner,
  expenseBody,
  postTransaction,
  refundBody,
  TRANSACTIONS_URL,
} from "../../testing/transaction-route-fixture.js";
import {
  refundsExistProblemSchema,
  transactionResponseSchema,
} from "./transaction.schemas.js";

const { withRollback } = setupTestDatabase();

interface DeleteTransactionRequest {
  id: string;
  cookie?: string;
}

function deleteTransaction(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<DeleteTransactionRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}`, {
    method: "DELETE",
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

describe("DELETE /v1/transactions/{transactionId}", () => {
  test("deletes an eligible transaction with no response body and repeats without a second history entry", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-eligible",
            body: expenseBody(owner),
          })
        ).json(),
      );

      const response = await deleteTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");

      // Repeating the deletion is the same outcome, not a second entry.
      expect(
        (await deleteTransaction(app, { id: expense.id, cookie: owner.cookie }))
          .status,
      ).toBe(204);
    });
  });

  test("an expense with linked refunds stays and lists them in its conflict problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-blocked-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const refund = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-blocked-refund",
            body: refundBody(owner, expense.id),
          })
        ).json(),
      );

      const problem = refundsExistProblemSchema.parse(
        await expectProblem(
          await deleteTransaction(app, {
            id: expense.id,
            cookie: owner.cookie,
          }),
          { status: 409, code: "refunds-exist" },
        ),
      );
      expect(problem.refunds).toEqual([
        {
          id: refund.id,
          amount: refund.amount,
          transactionDate: refund.transactionDate,
          wallet: refund.wallet,
        },
      ]);
    });
  });
});
