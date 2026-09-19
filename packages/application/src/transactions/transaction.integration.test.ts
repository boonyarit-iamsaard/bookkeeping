import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
  removeCategory,
} from "../categories/category";
import { insertTransaction } from "../testing/transaction-fixture";
import {
  createTransaction,
  findExpenseRefunds,
  findLastUsedWalletId,
  findReplayedTransaction,
  findTransaction,
  listTransactionPage,
  listTransactions,
} from "./transaction";

const { withRollback } = setupTestDatabase();

interface WalletFixture {
  ownerId: string;
  name: string;
  type: WalletType;
  openingAmount?: bigint;
}

/** Persists a wallet row directly; creation moves here with its own ticket. */
async function insertWallet(
  db: Database,
  fixture: Readonly<WalletFixture>,
): Promise<string> {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: fixture.ownerId,
      name: fixture.name,
      type: fixture.type,
      currency: "THB",
      openingAmount: fixture.openingAmount ?? 0n,
      openingDate: "2026-09-01",
    })
    .returning({ id: wallets.id });
  if (!row) {
    throw new Error("Wallet insert returned no row");
  }
  return row.id;
}

interface OwnerFixture {
  ownerId: string;
  cashId: string;
  bankId: string;
  parentId: string;
  childId: string;
  incomeId: string;
}

/** A fresh owner with two wallets and the default expense tree to file under. */
async function setupOwner(db: Database): Promise<OwnerFixture> {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const cashId = await insertWallet(db, {
    ownerId: owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 1_000_000n,
  });
  const bankId = await insertWallet(db, {
    ownerId: owner.id,
    name: "Bank",
    type: "bank_account",
  });
  const tree = await listCategories(db, owner.id);
  const parent = tree.find(
    (category) =>
      category.kind === "expense" && category.name === "Food & Drink",
  );
  const child = tree.find(
    (category) => category.kind === "expense" && category.name === "Groceries",
  );
  const income = tree.find(
    (category) => category.kind === "income" && category.name === "Salary",
  );
  if (!parent || !child || !income) {
    throw new Error("Missing default categories");
  }
  return {
    ownerId: owner.id,
    cashId,
    bankId,
    parentId: parent.id,
    childId: child.id,
    incomeId: income.id,
  };
}

async function softDelete(db: Database, id: string): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(eq(transactions.id, id));
}

describe("createTransaction", () => {
  test("records income and expense details with exact money and category trees", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "application-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_345n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "application-income",
        type: "income",
        walletId: owner.bankId,
        categoryId: owner.incomeId,
        amount: 100_000n,
        transactionDate: "2026-09-03",
        note: "Salary",
      });

      expect(expense.ok).toBe(true);
      expect(income.ok).toBe(true);
      if (!expense.ok || !income.ok) {
        throw new Error("Expected both transaction creations to succeed");
      }
      expect(expense.value.replayed).toBe(false);
      expect(expense.value.transaction).toEqual(
        expect.objectContaining({
          type: "expense",
          amount: 12_345n,
          transactionDate: "2026-09-02",
          note: "Lunch",
          wallet: expect.objectContaining({ id: owner.cashId }),
          category: expect.objectContaining({
            id: owner.childId,
            name: "Groceries",
            parentName: "Food & Drink",
          }),
          destinationWallet: null,
          refundOf: null,
        }),
      );
      expect(income.value.transaction.category).toEqual(
        expect.objectContaining({ id: owner.incomeId, name: "Salary" }),
      );
    });
  });

  test("rejects invalid dates, bounded values, and dates outside wallet history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const base = {
        ownerId: owner.ownerId,
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      };
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "invalid-calendar-date",
          transactionDate: "2026-02-30",
        }),
      ).toEqual({ ok: false, error: { code: "invalid-date" } });
      const corrected = await createTransaction(db, {
        ...base,
        idempotencyKey: "invalid-calendar-date",
      });
      expect(corrected.ok && corrected.value.replayed).toBe(false);

      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "zero-amount",
          amount: 0n,
        }),
      ).toEqual({ ok: false, error: { code: "amount-out-of-range" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "long-note",
          note: "x".repeat(201),
        }),
      ).toEqual({ ok: false, error: { code: "note-too-long" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "future-date",
          transactionDate: "2999-01-01",
        }),
      ).toEqual({
        ok: false,
        error: { code: "future-date", today: expect.any(String) },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "before-opening",
          transactionDate: "2026-08-31",
        }),
      ).toEqual({
        ok: false,
        error: { code: "before-opening", openingDate: "2026-09-01" },
      });
    });
  });

  test("requires owned active wallets and a category from the matching tree", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const base = {
        ownerId: owner.ownerId,
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      };
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "foreign-wallet",
          walletId: foreign.cashId,
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "foreign-category",
          categoryId: foreign.childId,
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "wrong-category-tree",
          categoryId: owner.incomeId,
        }),
      ).toEqual({ ok: false, error: { code: "category-kind-mismatch" } });

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.cashId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "archived-wallet",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owner.cashId },
      });
    });
  });

  test("replays its original detail after edits or deletion and conflicts on changed payloads", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "stable-transaction-result",
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_345n,
        transactionDate: "2026-09-02",
        note: "Original",
      };
      const first = await createTransaction(db, input);
      if (!first.ok) {
        throw new Error("Expected the transaction to save");
      }
      await db
        .update(transactions)
        .set({ amount: 60_000n, note: "Edited" })
        .where(eq(transactions.id, first.value.transaction.id));

      const afterEdit = await createTransaction(db, input);
      expect(afterEdit).toEqual({
        ok: true,
        value: { transaction: first.value.transaction, replayed: true },
      });

      await softDelete(db, first.value.transaction.id);
      const afterDelete = await createTransaction(db, input);
      expect(afterDelete).toEqual(afterEdit);
      expect(
        await findTransaction(db, {
          ownerId: input.ownerId,
          id: first.value.transaction.id,
        }),
      ).toBeNull();
      expect(
        await createTransaction(db, { ...input, amount: 12_346n }),
      ).toEqual({ ok: false, error: { code: "idempotency-conflict" } });
    });
  });
});

describe("findTransaction", () => {
  test("maps an expense's money, dates, recording instant, wallet, and category tree", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const recordedAt = new Date("2026-09-05T03:07:08.000Z");
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_345n,
        transactionDate: "2026-09-02",
        note: "Lunch",
        recordedAt,
      });

      const detail = await findTransaction(db, {
        ownerId: owner.ownerId,
        id,
      });
      expect(detail?.id).toBe(id);
      expect(detail?.type).toBe("expense");
      expect(detail?.currency).toBe("THB");
      expect(detail?.amount).toBe(12_345n);
      expect(detail?.transactionDate).toBe("2026-09-02");
      expect(detail?.note).toBe("Lunch");
      expect(detail?.recordedAt).toEqual(recordedAt);
      expect(detail?.wallet).toEqual({
        id: owner.cashId,
        name: "Cash",
        type: "cash",
        archived: false,
      });
      expect(detail?.destinationWallet).toBeNull();
      expect(detail?.category).toEqual({
        id: owner.childId,
        name: "Groceries",
        iconId: expect.any(String),
        parentName: "Food & Drink",
      });
      expect(detail?.refundOf).toBeNull();
    });
  });

  test("maps a transfer's destination wallet and a refund's expense link with the expense's current category", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transferId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 1_000n,
        transactionDate: "2026-09-03",
      });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 500n,
        transactionDate: "2026-09-04",
      });

      const transfer = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: transferId,
      });
      expect(transfer?.destinationWallet).toEqual({
        id: owner.bankId,
        name: "Bank",
        type: "bank_account",
        archived: false,
      });
      expect(transfer?.category).toBeNull();

      const refund = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: refundId,
      });
      expect(refund?.refundOf).toEqual({
        id: expenseId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
      });
      expect(refund?.category).toEqual({
        id: owner.childId,
        name: "Groceries",
        iconId: expect.any(String),
        parentName: "Food & Drink",
      });
    });
  });

  test("a refund's category follows its expense through a removal fallback", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 500n,
        transactionDate: "2026-09-03",
      });

      const removed = await removeCategory(db, {
        ownerId: owner.ownerId,
        id: owner.childId,
      });
      if (!removed.ok) {
        throw new Error("Child removal rejected");
      }

      const refund = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: refundId,
      });
      expect(refund?.category).toEqual({
        id: removed.value.fallbackId,
        name: "Food & Drink",
        iconId: expect.any(String),
        parentName: null,
      });
    });
  });

  test("another user's, deleted, and malformed identifiers are not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });

      expect(
        await findTransaction(db, { ownerId: foreign.ownerId, id }),
      ).toBeNull();
      await softDelete(db, id);
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id }),
      ).toBeNull();
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: "not-a-uuid" }),
      ).toBeNull();
    });
  });
});

describe("findReplayedTransaction", () => {
  test("reads back a since-deleted record for a late retry and hides other owners'", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });
      await softDelete(db, id);

      const replayed = await findReplayedTransaction(db, {
        ownerId: owner.ownerId,
        id,
      });
      expect(replayed?.id).toBe(id);
      expect(replayed?.type).toBe("expense");
      expect(
        await findReplayedTransaction(db, { ownerId: foreign.ownerId, id }),
      ).toBeNull();
      expect(
        await findReplayedTransaction(db, {
          ownerId: owner.ownerId,
          id: "not-a-uuid",
        }),
      ).toBeNull();
    });
  });
});

describe("findExpenseRefunds", () => {
  test("totals the linked refunds and what remains, oldest date first", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
      });
      const laterId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 500n,
        transactionDate: "2026-09-04",
      });
      const earlierId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: expenseId,
        amount: 2_000n,
        transactionDate: "2026-09-03",
      });

      const summary = await findExpenseRefunds(db, {
        ownerId: owner.ownerId,
        id: expenseId,
      });
      expect(summary?.refunds.map((refund) => refund.id)).toEqual([
        earlierId,
        laterId,
      ]);
      expect(summary?.refunds[0]).toEqual({
        id: earlierId,
        amount: 2_000n,
        transactionDate: "2026-09-03",
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
      });
      expect(summary?.refundedTotal).toBe(2_500n);
      expect(summary?.remaining).toBe(2_500n);
    });
  });

  test("the remainder never reads as negative and deleted refunds stop counting", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
      });
      const countedId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 2_000n,
        transactionDate: "2026-09-03",
      });
      const deletedId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 4_000n,
        transactionDate: "2026-09-04",
      });
      await softDelete(db, deletedId);

      const summary = await findExpenseRefunds(db, {
        ownerId: owner.ownerId,
        id: expenseId,
      });
      expect(summary?.refunds.map((refund) => refund.id)).toEqual([countedId]);
      expect(summary?.refundedTotal).toBe(2_000n);
      expect(summary?.remaining).toBe(3_000n);
    });
  });

  test("only a current owned expense has an allowance", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });
      const incomeId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });
      const transferId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        transactionDate: "2026-09-02",
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        transactionDate: "2026-09-03",
      });

      expect(
        await findExpenseRefunds(db, { ownerId: owner.ownerId, id: incomeId }),
      ).toBeNull();
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: transferId,
        }),
      ).toBeNull();
      expect(
        await findExpenseRefunds(db, { ownerId: owner.ownerId, id: refundId }),
      ).toBeNull();
      expect(
        await findExpenseRefunds(db, {
          ownerId: foreign.ownerId,
          id: expenseId,
        }),
      ).toBeNull();
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: "not-a-uuid",
        }),
      ).toBeNull();

      await softDelete(db, expenseId);
      expect(
        await findExpenseRefunds(db, { ownerId: owner.ownerId, id: expenseId }),
      ).toBeNull();
    });
  });
});

describe("findLastUsedWalletId", () => {
  test("names the wallet of the most recently recorded transaction", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        recordedAt: new Date("2026-09-05T01:00:00.000Z"),
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.bankId,
        categoryId: owner.childId,
        recordedAt: new Date("2026-09-05T02:00:00.000Z"),
      });

      expect(await findLastUsedWalletId(db, owner.ownerId)).toBe(owner.bankId);
    });
  });

  test("deleted transactions never count and an owner without history has none", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      expect(await findLastUsedWalletId(db, owner.ownerId)).toBeNull();

      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });
      await softDelete(db, id);
      expect(await findLastUsedWalletId(db, owner.ownerId)).toBeNull();
    });
  });
});

describe("listTransactions", () => {
  test("lists owned current transactions newest date first and hides other owners'", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const olderId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });
      const newerId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-03",
      });
      const deletedId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-04",
      });
      await softDelete(db, deletedId);

      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).map(
          (transaction) => transaction.id,
        ),
      ).toEqual([newerId, olderId]);
      expect(await listTransactions(db, { ownerId: foreign.ownerId })).toEqual(
        [],
      );
    });
  });

  test("pages ties by date, recording time, and id without offset drift", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const recordedAt = new Date("2026-09-05T03:07:08.123Z");
      const oldestId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });
      const middleId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });
      const newestId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });

      const first = await listTransactionPage(db, {
        ownerId: owner.ownerId,
        limit: 2,
      });
      expect(first.items.map((transaction) => transaction.id)).toEqual([
        newestId,
        middleId,
      ]);
      expect(first.nextPosition).not.toBeNull();

      const insertedBeforeCursorId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-06",
      });
      expect(insertedBeforeCursorId).not.toBe(first.nextPosition?.id);

      const second = await listTransactionPage(db, {
        ownerId: owner.ownerId,
        limit: 2,
        after: first.nextPosition ?? undefined,
      });
      expect(second.items.map((transaction) => transaction.id)).toEqual([
        oldestId,
      ]);
      expect(second.nextPosition).toBeNull();
    });
  });

  test("orders equal dates by recording time before using the identifier", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const older = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt: new Date("2026-09-05T03:07:08.001Z"),
      });
      const newer = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt: new Date("2026-09-05T03:07:08.002Z"),
      });

      const page = await listTransactionPage(db, {
        ownerId: owner.ownerId,
        limit: 10,
      });
      expect(page.items.map((transaction) => transaction.id)).toEqual([
        newer,
        older,
      ]);
    });
  });
});
