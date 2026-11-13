import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import {
  expectFieldErrors,
  expectProblem,
} from "../../testing/expect-problem.js";
import type {
  OwnerFixture,
  TransactionCreationBody,
} from "../../testing/transaction-route-fixture.js";
import {
  createOwner,
  expenseBody,
  postTransaction,
  refundBody,
  UNKNOWN_TRANSACTION_ID,
} from "../../testing/transaction-route-fixture.js";
import { transactionResponseSchema } from "./transaction.routes.js";

const { withRollback } = setupTestDatabase();

function transferBody(owner: Readonly<OwnerFixture>) {
  return {
    type: "transfer",
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    destinationWalletId: owner.bankId,
    transactionDate: "2026-09-02",
    note: "Move money",
  } satisfies Extract<TransactionCreationBody, { type: "transfer" }>;
}

describe("POST /v1/transactions", () => {
  test("creates a transfer without category or refund fields and changes both balances", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const response = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "transfer-create",
        body: transferBody(owner),
      });
      const transfer = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("location")).toBe(
        `/v1/transactions/${transfer.id}`,
      );
      expect(transfer).toEqual({
        id: transfer.id,
        type: "transfer",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-02",
        note: "Move money",
        recordedAt: expect.any(String),
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        category: null,
        refundOf: null,
        tags: [],
      });
    });
  });
  test("maps request validation failures to field errors", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const transfer = transferBody(owner);
      const refund = refundBody(owner, UNKNOWN_TRANSACTION_ID);
      for (const [idempotencyKey, body, expected] of [
        [
          "transfer-missing-destination",
          { ...transfer, destinationWalletId: undefined },
          { pointer: "#/destinationWalletId", code: "invalid-type" },
        ],
        [
          "transfer-category",
          { ...transfer, categoryId: owner.childId },
          { pointer: "#/", code: "unrecognized-keys" },
        ],
        [
          "transfer-refund",
          { ...transfer, refundOfTransactionId: UNKNOWN_TRANSACTION_ID },
          { pointer: "#/", code: "unrecognized-keys" },
        ],
        [
          "refund-missing-link",
          { ...refund, refundOfTransactionId: undefined },
          { pointer: "#/refundOfTransactionId", code: "invalid-type" },
        ],
        [
          "refund-category",
          { ...refund, categoryId: owner.childId },
          { pointer: "#/", code: "unrecognized-keys" },
        ],
      ] as const) {
        const problem = await expectProblem(
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey,
            body,
          }),
          { status: 422, code: "invalid-command" },
        );
        expect(problem.errors).toEqual([expected]);
      }
    });
  });

  test("creates income and expense details with semantic money and locations", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expenseResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "expense-create",
        body: expenseBody(owner),
      });
      const expense = transactionResponseSchema.parse(
        await expenseResponse.json(),
      );
      expect(expenseResponse.status).toBe(201);
      expect(expenseResponse.headers.get("location")).toBe(
        `/v1/transactions/${expense.id}`,
      );
      expect(expense).toEqual({
        id: expense.id,
        type: "expense",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-02",
        note: "Lunch",
        recordedAt: expect.any(String),
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
        refundOf: null,
        tags: [],
      });

      const income = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "income-create",
            body: {
              ...expenseBody(owner),
              type: "income",
              amount: { value: "1000.10", currency: "THB" },
              walletId: owner.bankId,
              categoryId: owner.incomeId,
              note: "Salary",
            },
          })
        ).json(),
      );
      expect(income.type).toBe("income");
      expect(income.amount).toEqual({ value: "1000.10", currency: "THB" });
      expect(income.category?.id).toBe(owner.incomeId);
    });
  });

  test("replays normalized money and the original snapshot, and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const originalBody = {
        ...expenseBody(owner),
        amount: { value: "123.4", currency: "THB" },
      };
      const firstResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: originalBody,
      });
      const first = transactionResponseSchema.parse(await firstResponse.json());
      const malformedReplay = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: { ...originalBody, amount: { value: "123.450" } },
      });
      expect(malformedReplay.status).toBe(422);

      const normalizedReplayResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: { ...originalBody, amount: { value: "123.40", currency: "THB" } },
      });
      const normalizedReplay = transactionResponseSchema.parse(
        await normalizedReplayResponse.json(),
      );
      expect(normalizedReplayResponse.status).toBe(201);
      expect(normalizedReplayResponse.headers.get("location")).toBe(
        firstResponse.headers.get("location"),
      );
      expect(normalizedReplay).toEqual(first);
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "retry",
          body: {
            ...originalBody,
            amount: { value: "124.40", currency: "THB" },
          },
        }),
        { status: 409, code: "idempotency-conflict" },
      );
    });
  });

  test("a rule rejection answers its field errors and does not consume the key", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const base = expenseBody(owner);
      const invalidDate = await expectFieldErrors(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "correct-date",
          body: { ...base, transactionDate: "2026-02-30" },
        }),
      );
      expect(invalidDate).toEqual([
        { pointer: "#/transactionDate", code: "invalid-date" },
      ]);
      expect(
        (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "correct-date",
            body: base,
          })
        ).status,
      ).toBe(201);
    });
  });

  test("requires a usable idempotency key and valid JSON", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      for (const idempotencyKey of [undefined, "   ", "x".repeat(256)]) {
        await expectProblem(
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey,
            body: expenseBody(owner),
          }),
          { status: 400, code: "idempotency-key-required" },
        );
      }
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "malformed-json",
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("creates a full refund with its expense link and inherited category", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const response = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "refund-create",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "123.45", currency: "THB" },
        },
      });
      const refund = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("location")).toBe(
        `/v1/transactions/${refund.id}`,
      );
      expect(refund).toEqual({
        id: refund.id,
        type: "refund",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-03",
        note: "Returned",
        recordedAt: expect.any(String),
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
        refundOf: {
          id: expense.id,
          amount: { value: "123.45", currency: "THB" },
          transactionDate: "2026-09-02",
        },
        tags: [],
      });
    });
  });
});
