import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import type { OwnerFixture } from "../testing/transaction-suite-fixture";
import {
  recordExpense,
  setupOwner,
  softDelete,
} from "../testing/transaction-suite-fixture";
import { createTransaction } from "./transaction";
import type { TransactionCorrection } from "./transaction-judgement";
import {
  judgeCorrection,
  judgeNewTransaction,
  lockForDeletion,
} from "./transaction-judgement";
import type { TransactionCommand } from "./transaction-rules";

const { withRollback } = setupTestDatabase();

function newExpense(owner: OwnerFixture): TransactionCommand {
  return {
    type: "expense",
    walletId: owner.cashId,
    categoryId: owner.childId,
    destinationWalletId: null,
    refundOfTransactionId: null,
    amount: 10_000n,
    transactionDate: "2026-09-02",
    note: "Lunch",
    tagIds: [],
  };
}

function sameCorrection(owner: OwnerFixture): TransactionCorrection {
  return {
    walletId: owner.cashId,
    categoryId: owner.childId,
    destinationWalletId: null,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
    tagIds: [],
  };
}

function archive(db: Database, walletId: string) {
  return db
    .update(wallets)
    .set({ archivedAt: new Date() })
    .where(eq(wallets.id, walletId));
}

async function recordRefund(
  db: Database,
  { owner, expenseId }: Readonly<{ owner: OwnerFixture; expenseId: string }>,
) {
  const created = await createTransaction(db, {
    ownerId: owner.ownerId,
    idempotencyKey: `judgement-refund-${crypto.randomUUID()}`,
    type: "refund",
    walletId: owner.cashId,
    categoryId: null,
    refundOfTransactionId: expenseId,
    amount: 10_000n,
    transactionDate: "2026-09-03",
    note: "Returned item",
  });
  if (!created.ok) {
    throw new Error("Expected the refund to save");
  }
  return created.value.transaction;
}

describe("judgeNewTransaction", () => {
  test("an archived wallet is refused for a new entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      await archive(db, owner.cashId);
      expect(
        await judgeNewTransaction(db, {
          ownerId: owner.ownerId,
          command: newExpense(owner),
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "walletId",
          code: "wallet-archived",
          walletId: owner.cashId,
        },
      });
    });
  });

  test("a category from the other tree is refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      expect(
        await judgeNewTransaction(db, {
          ownerId: owner.ownerId,
          command: { ...newExpense(owner), categoryId: owner.incomeId },
        }),
      ).toEqual({
        ok: false,
        error: { field: "categoryId", code: "category-kind-mismatch" },
      });
    });
  });

  test("another owner's wallet reads as not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const other = await setupOwner(db);
      expect(
        await judgeNewTransaction(db, {
          ownerId: owner.ownerId,
          command: { ...newExpense(owner), walletId: other.cashId },
        }),
      ).toEqual({
        ok: false,
        error: { field: "walletId", code: "wallet-not-found" },
      });
    });
  });

  test("another owner's destination wallet reads as not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const other = await setupOwner(db);
      expect(
        await judgeNewTransaction(db, {
          ownerId: owner.ownerId,
          command: {
            ...newExpense(owner),
            type: "transfer",
            categoryId: null,
            destinationWalletId: other.bankId,
          },
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "destinationWalletId",
          code: "destination-wallet-not-found",
        },
      });
    });
  });

  test("another owner's or a malformed category reads as not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const other = await setupOwner(db);
      for (const categoryId of [other.childId, "not-a-uuid"]) {
        expect(
          await judgeNewTransaction(db, {
            ownerId: owner.ownerId,
            command: { ...newExpense(owner), categoryId },
          }),
        ).toEqual({
          ok: false,
          error: { field: "categoryId", code: "category-not-found" },
        });
      }
    });
  });

  test("a refund of anything but the owner's current expense finds no expense", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const other = await setupOwner(db);
      const foreignExpense = await recordExpense(db, other);
      const deletedExpense = await recordExpense(db, owner);
      await softDelete(db, deletedExpense.id);
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `judgement-income-${crypto.randomUUID()}`,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        amount: 10_000n,
        transactionDate: "2026-09-02",
        note: "Salary",
      });
      if (!income.ok) {
        throw new Error("Expected the income to save");
      }

      for (const refundOfTransactionId of [
        foreignExpense.id,
        deletedExpense.id,
        income.value.transaction.id,
        crypto.randomUUID(),
        "not-a-uuid",
      ]) {
        expect(
          await judgeNewTransaction(db, {
            ownerId: owner.ownerId,
            command: {
              ...newExpense(owner),
              type: "refund",
              categoryId: null,
              refundOfTransactionId,
              transactionDate: "2026-09-03",
            },
          }),
        ).toEqual({
          ok: false,
          error: { field: "refundOfTransactionId", code: "expense-not-found" },
        });
      }
    });
  });
});

describe("judgeCorrection", () => {
  test("a foreign, deleted, unknown, or malformed id reads as not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await createTestUser(db);
      const expense = await recordExpense(db, owner);
      const deleted = await recordExpense(db, owner);
      await softDelete(db, deleted.id);
      const notFound = { ok: false, error: { code: "transaction-not-found" } };

      for (const { ownerId, id } of [
        { ownerId: stranger.id, id: expense.id },
        { ownerId: owner.ownerId, id: deleted.id },
        { ownerId: owner.ownerId, id: crypto.randomUUID() },
        { ownerId: owner.ownerId, id: "not-a-uuid" },
      ]) {
        expect(
          await judgeCorrection(db, {
            ownerId,
            id,
            correction: sameCorrection(owner),
          }),
        ).toEqual(notFound);
      }
    });
  });

  test("a retained archived wallet is allowed, and the type and refund link stay fixed", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const refund = await recordRefund(db, { owner, expenseId: expense.id });
      await archive(db, owner.cashId);

      const judged = await judgeCorrection(db, {
        ownerId: owner.ownerId,
        id: refund.id,
        correction: {
          ...sameCorrection(owner),
          categoryId: null,
          amount: 20_000n,
          transactionDate: "2026-09-03",
          note: "Returned two items",
        },
      });
      expect(judged).toEqual({
        ok: true,
        value: {
          current: expect.objectContaining({
            id: refund.id,
            type: "refund",
            refundOfTransactionId: expense.id,
            amount: 10_000n,
            tagIds: [],
          }),
          command: expect.objectContaining({
            type: "refund",
            walletId: owner.cashId,
            refundOfTransactionId: expense.id,
            amount: 20_000n,
          }),
        },
      });
    });
  });

  test("a newly named archived wallet is still refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      await archive(db, owner.bankId);
      expect(
        await judgeCorrection(db, {
          ownerId: owner.ownerId,
          id: expense.id,
          correction: { ...sameCorrection(owner), walletId: owner.bankId },
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "walletId",
          code: "wallet-archived",
          walletId: owner.bankId,
        },
      });
    });
  });
});

describe("lockForDeletion", () => {
  test("a foreign, unknown, or malformed id is not found, and a deleted one is already deleted", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await createTestUser(db);
      const expense = await recordExpense(db, owner);
      const deleted = await recordExpense(db, owner);
      await softDelete(db, deleted.id);

      for (const ref of [
        { ownerId: stranger.id, id: expense.id },
        { ownerId: owner.ownerId, id: crypto.randomUUID() },
        { ownerId: owner.ownerId, id: "not-a-uuid" },
      ]) {
        expect(await lockForDeletion(db, ref)).toEqual({ kind: "not-found" });
      }
      expect(
        await lockForDeletion(db, { ownerId: owner.ownerId, id: deleted.id }),
      ).toEqual({ kind: "already-deleted" });
    });
  });

  test("an expense's counting refunds block its deletion; a refund blocks nothing", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const refund = await recordRefund(db, { owner, expenseId: expense.id });

      expect(
        await lockForDeletion(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({
        kind: "current",
        current: expect.objectContaining({ id: expense.id, type: "expense" }),
        blockingRefunds: [
          expect.objectContaining({ id: refund.id, amount: 10_000n }),
        ],
      });
      expect(
        await lockForDeletion(db, { ownerId: owner.ownerId, id: refund.id }),
      ).toEqual({
        kind: "current",
        current: expect.objectContaining({ id: refund.id, type: "refund" }),
        blockingRefunds: [],
      });
    });
  });
});
