import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type * as z from "zod";
import type { AppEnv } from "../../core/http/request-context.js";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import {
  expectFieldErrors,
  expectProblem,
} from "../../testing/expect-problem.js";
import type { OwnerFixture } from "../../testing/transaction-route-fixture.js";
import {
  createOwner,
  expenseBody,
  postTransaction,
  refundBody,
  TRANSACTIONS_URL,
  UNKNOWN_TRANSACTION_ID,
} from "../../testing/transaction-route-fixture.js";
import type { updateTransactionRequestSchema } from "./transaction.routes.js";
import { transactionResponseSchema } from "./transaction.routes.js";

const { withRollback } = setupTestDatabase();

type TransactionUpdateBody = z.input<typeof updateTransactionRequestSchema>;

function updateExpenseBody(
  owner: Readonly<OwnerFixture>,
): TransactionUpdateBody {
  return {
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    categoryId: owner.childId,
    transactionDate: "2026-09-02",
    note: "Lunch",
    tagIds: [],
  };
}

interface UpdateTransactionRequest {
  id: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

function putTransaction(
  app: Hono<AppEnv>,
  { id, cookie, body = {}, rawBody }: Readonly<UpdateTransactionRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    // An edit naming no tag change sends the tags carried: none here.
    body: rawBody ?? JSON.stringify({ tagIds: [], ...Object(body) }),
  });
}

describe("PUT /v1/transactions/{transactionId}", () => {
  test("corrects an expense with exact money, wallet, category, and date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const response = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "50.00", currency: "THB" },
          walletId: owner.bankId,
          categoryId: owner.childId,
          transactionDate: "2026-09-03",
          note: "Corrected",
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated).toEqual({
        id: expense.id,
        type: "expense",
        amount: { value: "50.00", currency: "THB" },
        transactionDate: "2026-09-03",
        note: "Corrected",
        recordedAt: expense.recordedAt,
        wallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: null,
        tags: [],
      });
    });
  });

  test("corrects a refund inside its expense, keeping the link and inherited category", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refund-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "500.00", currency: "THB" },
            },
          })
        ).json(),
      );
      const first = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refund-first",
            body: {
              ...refundBody(owner, expense.id),
              amount: { value: "300.00", currency: "THB" },
            },
          })
        ).json(),
      );
      await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "update-refund-second",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "100.00", currency: "THB" },
          transactionDate: "2026-09-05",
        },
      });

      // The other refund holds ฿100.00, so the corrected one may take ฿400.00.
      const response = await putTransaction(app, {
        id: first.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "400.00", currency: "THB" },
          walletId: owner.cashId,
          transactionDate: "2026-09-04",
          note: "Returned",
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated).toEqual({
        id: first.id,
        type: "refund",
        amount: { value: "400.00", currency: "THB" },
        transactionDate: "2026-09-04",
        note: "Returned",
        recordedAt: first.recordedAt,
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: {
          id: expense.id,
          amount: { value: "500.00", currency: "THB" },
          transactionDate: "2026-09-02",
        },
        tags: [],
      });
    });
  });

  test("maps a rule rejection into the update document and rejects unknown keys", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-validation",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const base = updateExpenseBody(owner);
      // The update document names no type, so a type rejection addresses its root.
      const invalidTransfer = await expectFieldErrors(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: { ...base, destinationWalletId: owner.bankId },
        }),
      );
      expect(invalidTransfer).toEqual([
        { pointer: "#/", code: "invalid-transfer" },
      ]);
      const unrecognized = await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: { ...base, note: "Edited", extra: true },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(unrecognized.errors).toEqual([
        { pointer: "#/", code: "unrecognized-keys" },
      ]);
    });
  });

  test("rejects malformed JSON with the standard problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      await expectProblem(
        await putTransaction(app, {
          id: UNKNOWN_TRANSACTION_ID,
          cookie: owner.cookie,
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});
