import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
  removeCategory,
} from "../categories/category";
import { insertTransaction } from "../testing/transaction-fixture";
import { listWallets } from "../wallets/wallet";
import type { CreateTransactionInput } from "./transaction";
import {
  createTransaction,
  deleteTransaction,
  findExpenseRefunds,
  findLastUsedWalletId,
  findReplayedTransaction,
  findTransaction,
  listTransactionChanges,
  listTransactionPage,
  listTransactions,
  updateTransaction,
} from "./transaction";

const { withRollback, committed } = setupTestDatabase();

interface WalletFixture {
  ownerId: string;
  name: string;
  type: WalletType;
  openingAmount?: bigint;
  openingDate?: string;
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
      openingDate: fixture.openingDate ?? "2026-09-01",
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

function withClock<T>(iso: string, run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  return run().finally(() => vi.useRealTimers());
}

/** A committed ฿500 groceries expense on 2 Sep from the owner's Cash wallet. */
async function recordExpense(db: Database, owner: OwnerFixture) {
  const created = await createTransaction(db, {
    ownerId: owner.ownerId,
    idempotencyKey: `update-expense-${crypto.randomUUID()}`,
    type: "expense",
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
  });
  if (!created.ok) {
    throw new Error(`Expected the expense to save, got ${created.error.code}`);
  }
  return created.value.transaction;
}

interface UpdateExpenseInputOptions {
  owner: OwnerFixture;
  transaction: { id: string };
}

/** The valid edit of the fixture expense, before any overrides. */
function expenseUpdateInput({
  owner,
  transaction,
}: Readonly<UpdateExpenseInputOptions>) {
  return {
    ownerId: owner.ownerId,
    id: transaction.id,
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
  };
}

interface BalanceOptions {
  db: Database;
  ownerId: string;
  walletId: string;
  asOf?: string;
}

async function balanceOf({
  db,
  ownerId,
  walletId,
  asOf,
}: Readonly<BalanceOptions>) {
  const summaries = await listWallets(db, { ownerId, asOf });
  const found = summaries.find((wallet) => wallet.id === walletId);
  if (!found) {
    throw new Error("Wallet not listed");
  }
  return found.balance;
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

  test("moves money between both wallet balances as one transfer", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "application-transfer",
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        currency: "THB",
        amount: 12_345n,
        transactionDate: "2026-09-02",
        note: "Move money",
      });

      expect(created).toEqual({
        ok: true,
        value: {
          replayed: false,
          transaction: expect.objectContaining({
            type: "transfer",
            amount: 12_345n,
            wallet: expect.objectContaining({ id: owner.cashId }),
            destinationWallet: expect.objectContaining({ id: owner.bankId }),
            category: null,
            refundOf: null,
          }),
        },
      });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map((wallet) => ({
          id: wallet.id,
          balance: wallet.balance,
        })),
      ).toEqual([
        { id: owner.cashId, balance: 987_655n },
        { id: owner.bankId, balance: 12_345n },
      ]);
    });
  });

  test("replays a transfer and conflicts when its payload changes", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "transfer-retry",
        type: "transfer" as const,
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        currency: "THB" as const,
        amount: 12_345n,
        transactionDate: "2026-09-02" as const,
        note: "Move money",
      };

      const first = await createTransaction(db, input);
      if (!first.ok) {
        throw new Error("Expected the transfer to save");
      }
      const retry = await createTransaction(db, input);
      expect(retry).toEqual({
        ok: true,
        value: { transaction: first.value.transaction, replayed: true },
      });
      expect(
        await createTransaction(db, { ...input, amount: 12_346n }),
      ).toEqual({ ok: false, error: { code: "idempotency-conflict" } });
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).filter(
          (transaction) => transaction.type === "transfer",
        ),
      ).toHaveLength(1);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([987_655n, 12_345n]);
    });
  });

  test("concurrent transfer retries commit one movement and replay it", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const input = {
      ownerId: owner.ownerId,
      idempotencyKey: "transfer-concurrent",
      type: "transfer" as const,
      walletId: owner.cashId,
      destinationWalletId: owner.bankId,
      categoryId: null,
      currency: "THB" as const,
      amount: 12_345n,
      transactionDate: "2026-09-02" as const,
      note: "Move money",
    };

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => createTransaction(db, input)),
    );
    const successful = outcomes.flatMap((outcome) =>
      outcome.ok ? [outcome.value] : [],
    );

    expect(successful).toHaveLength(5);
    expect(
      new Set(successful.map((outcome) => outcome.transaction.id)).size,
    ).toBe(1);
    expect(successful.filter((outcome) => !outcome.replayed)).toHaveLength(1);
    expect(
      (await listTransactions(db, { ownerId: owner.ownerId })).filter(
        (transaction) => transaction.type === "transfer",
      ),
    ).toHaveLength(1);
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([987_655n, 12_345n]);
  });

  test("rejects invalid transfer shapes and cross-owner or unavailable wallets", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const base = {
        ownerId: owner.ownerId,
        type: "transfer" as const,
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        currency: "THB" as const,
        amount: 100n,
        transactionDate: "2026-09-02" as const,
        note: "",
      };

      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-same-wallet",
          destinationWalletId: owner.cashId,
        }),
      ).toEqual({ ok: false, error: { code: "same-wallet" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-category",
          categoryId: owner.childId,
        }),
      ).toEqual({ ok: false, error: { code: "invalid-transfer" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-missing-destination",
          destinationWalletId: null,
        }),
      ).toEqual({ ok: false, error: { code: "invalid-transfer" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-missing-currency",
          currency: undefined,
        }),
      ).toEqual({ ok: false, error: { code: "invalid-currency" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-foreign-source",
          walletId: foreign.cashId,
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-foreign-destination",
          destinationWalletId: foreign.bankId,
        }),
      ).toEqual({
        ok: false,
        error: { code: "destination-wallet-not-found" },
      });

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.cashId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-archived-source",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owner.cashId },
      });
      await db
        .update(wallets)
        .set({ archivedAt: null })
        .where(eq(wallets.id, owner.cashId));

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-archived-destination",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owner.bankId },
      });

      await db
        .update(wallets)
        .set({ archivedAt: null, openingDate: "2026-09-03" })
        .where(eq(wallets.id, owner.bankId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-before-destination-opening",
        }),
      ).toEqual({
        ok: false,
        error: { code: "before-opening", openingDate: "2026-09-03" },
      });

      await db
        .update(wallets)
        .set({ openingDate: "2026-09-01" })
        .where(eq(wallets.id, owner.bankId));
      await db
        .update(wallets)
        .set({ openingDate: "2026-09-03" })
        .where(eq(wallets.id, owner.cashId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-before-source-opening",
        }),
      ).toEqual({
        ok: false,
        error: { code: "before-opening", openingDate: "2026-09-03" },
      });
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).filter(
          (transaction) => transaction.type === "transfer",
        ),
      ).toHaveLength(0);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
    });
  });

  test("records a full refund with its expense link and inherited category", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "refund-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      if (!expense.ok) {
        throw new Error("Expected the expense to save");
      }
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "application-refund",
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.value.transaction.id,
        amount: 2_000n,
        transactionDate: "2026-09-03",
        note: "Returned",
      });

      expect(created).toEqual({
        ok: true,
        value: {
          replayed: false,
          transaction: expect.objectContaining({
            type: "refund",
            amount: 2_000n,
            transactionDate: "2026-09-03",
            note: "Returned",
            wallet: expect.objectContaining({ id: owner.bankId }),
            destinationWallet: null,
            category: expect.objectContaining({
              id: owner.childId,
              name: "Groceries",
              parentName: "Food & Drink",
            }),
            refundOf: {
              id: expense.value.transaction.id,
              amount: 2_000n,
              transactionDate: "2026-09-02",
            },
          }),
        },
      });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map((wallet) => ({
          id: wallet.id,
          balance: wallet.balance,
        })),
      ).toEqual([
        { id: owner.cashId, balance: 998_000n },
        { id: owner.bankId, balance: 2_000n },
      ]);
      const refunds = await findExpenseRefunds(db, {
        ownerId: owner.ownerId,
        id: expense.value.transaction.id,
      });
      expect(refunds?.refundedTotal).toBe(2_000n);
      expect(refunds?.remaining).toBe(0n);
    });
  });

  test("refunds part of an expense to an alternate wallet and tracks what remains", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "partial-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      if (!expense.ok) {
        throw new Error("Expected the expense to save");
      }
      const expenseId = expense.value.transaction.id;
      const toBank = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "partial-refund-bank",
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expenseId,
        amount: 1_200n,
        transactionDate: "2026-09-03",
        note: "Partial",
      });
      const toCash = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "partial-refund-cash",
        type: "refund",
        walletId: owner.cashId,
        categoryId: null,
        refundOfTransactionId: expenseId,
        amount: 2_500n,
        transactionDate: "2026-09-04",
        note: "Partial",
      });

      expect(toBank.ok).toBe(true);
      expect(toCash.ok).toBe(true);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map((wallet) => ({
          id: wallet.id,
          balance: wallet.balance,
        })),
      ).toEqual([
        { id: owner.cashId, balance: 997_500n },
        { id: owner.bankId, balance: 1_200n },
      ]);
      const refunds = await findExpenseRefunds(db, {
        ownerId: owner.ownerId,
        id: expenseId,
      });
      expect(refunds?.refundedTotal).toBe(3_700n);
      expect(refunds?.remaining).toBe(1_300n);
    });
  });

  test("rejects refunds that exceed what remains, predate the expense, or precede the receiving wallet's opening", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "limit-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      if (!expense.ok) {
        throw new Error("Expected the expense to save");
      }
      const base = {
        ownerId: owner.ownerId,
        type: "refund" as const,
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.value.transaction.id,
        amount: 100n,
        transactionDate: "2026-09-02" as const,
        note: "",
      };

      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-over-limit",
          amount: 2_001n,
        }),
      ).toEqual({
        ok: false,
        error: { code: "exceeds-refundable", remaining: 2_000n },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-before-expense",
          transactionDate: "2026-09-01",
        }),
      ).toEqual({
        ok: false,
        error: { code: "before-expense", expenseDate: "2026-09-02" },
      });
      await db
        .update(wallets)
        .set({ openingDate: "2026-09-04" })
        .where(eq(wallets.id, owner.bankId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-before-opening",
          transactionDate: "2026-09-03",
        }),
      ).toEqual({
        ok: false,
        error: { code: "before-opening", openingDate: "2026-09-04" },
      });
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).filter(
          (transaction) => transaction.type === "refund",
        ),
      ).toHaveLength(0);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([998_000n, 0n]);
    });
  });

  test("rejects archived receiving wallets and cross-owner or non-expense links", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const foreign = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "owner-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      const foreignExpense = await createTransaction(db, {
        ownerId: foreign.ownerId,
        idempotencyKey: "foreign-expense",
        type: "expense",
        walletId: foreign.cashId,
        categoryId: foreign.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "owner-income",
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "Salary",
      });
      const deletedExpense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "deleted-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      if (
        !expense.ok ||
        !foreignExpense.ok ||
        !income.ok ||
        !deletedExpense.ok
      ) {
        throw new Error("Expected the seed transactions to save");
      }
      await softDelete(db, deletedExpense.value.transaction.id);
      const base = {
        ownerId: owner.ownerId,
        type: "refund" as const,
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.value.transaction.id,
        amount: 100n,
        transactionDate: "2026-09-03" as const,
        note: "",
      };

      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-deleted-expense",
          refundOfTransactionId: deletedExpense.value.transaction.id,
        }),
      ).toEqual({ ok: false, error: { code: "expense-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-foreign-expense",
          refundOfTransactionId: foreignExpense.value.transaction.id,
        }),
      ).toEqual({ ok: false, error: { code: "expense-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-income-link",
          refundOfTransactionId: income.value.transaction.id,
        }),
      ).toEqual({ ok: false, error: { code: "expense-not-found" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-foreign-wallet",
          walletId: foreign.bankId,
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-archived-wallet",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owner.bankId },
      });
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).filter(
          (transaction) => transaction.type === "refund",
        ),
      ).toHaveLength(0);
    });
  });

  test("replays a refund and conflicts when its payload changes", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: "retry-expense",
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      });
      if (!expense.ok) {
        throw new Error("Expected the expense to save");
      }
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "refund-retry",
        type: "refund" as const,
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.value.transaction.id,
        amount: 500n,
        transactionDate: "2026-09-03" as const,
        note: "Partial",
      };

      const first = await createTransaction(db, input);
      if (!first.ok) {
        throw new Error("Expected the refund to save");
      }
      expect(await createTransaction(db, input)).toEqual({
        ok: true,
        value: { transaction: first.value.transaction, replayed: true },
      });
      expect(await createTransaction(db, { ...input, amount: 501n })).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).filter(
          (transaction) => transaction.type === "refund",
        ),
      ).toHaveLength(1);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([998_000n, 500n]);
    });
  });

  test("concurrent refund retries commit one refund and replay it", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: "concurrent-expense",
      type: "expense",
      walletId: owner.cashId,
      categoryId: owner.childId,
      amount: 2_000n,
      transactionDate: "2026-09-02",
      note: "Lunch",
    });
    if (!expense.ok) {
      throw new Error("Expected the expense to save");
    }
    const input = {
      ownerId: owner.ownerId,
      idempotencyKey: "refund-concurrent",
      type: "refund" as const,
      walletId: owner.bankId,
      categoryId: null,
      refundOfTransactionId: expense.value.transaction.id,
      amount: 500n,
      transactionDate: "2026-09-03" as const,
      note: "Partial",
    };

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => createTransaction(db, input)),
    );
    const successful = outcomes.flatMap((outcome) =>
      outcome.ok ? [outcome.value] : [],
    );

    expect(successful).toHaveLength(5);
    expect(
      new Set(successful.map((outcome) => outcome.transaction.id)).size,
    ).toBe(1);
    expect(successful.filter((outcome) => !outcome.replayed)).toHaveLength(1);
    expect(
      (await listTransactions(db, { ownerId: owner.ownerId })).filter(
        (transaction) => transaction.type === "refund",
      ),
    ).toHaveLength(1);
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([998_000n, 500n]);
  });

  test("concurrent distinct refunds cannot exceed the expense", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: "race-expense",
      type: "expense",
      walletId: owner.cashId,
      categoryId: owner.childId,
      amount: 1_000n,
      transactionDate: "2026-09-02",
      note: "Lunch",
    });
    if (!expense.ok) {
      throw new Error("Expected the expense to save");
    }

    const outcomes = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `refund-race-${index}`,
          type: "refund",
          walletId: owner.bankId,
          categoryId: null,
          refundOfTransactionId: expense.value.transaction.id,
          amount: 1_000n,
          transactionDate: "2026-09-03",
          note: "Full",
        }),
      ),
    );

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.error),
    ).toEqual([
      { code: "exceeds-refundable", remaining: 0n },
      { code: "exceeds-refundable", remaining: 0n },
    ]);
    expect(
      (await listTransactions(db, { ownerId: owner.ownerId })).filter(
        (transaction) => transaction.type === "refund",
      ),
    ).toHaveLength(1);
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([999_000n, 1_000n]);
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

describe("updateTransaction", () => {
  test("an edit replaces every financial effect, keeps the recording time, and leaves one history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const savingsId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Savings",
        type: "bank_account",
        openingDate: "2026-09-03",
      });
      const uncategorized = (await listCategories(db, owner.ownerId)).find(
        (category) =>
          category.kind === "expense" && category.name === "Uncategorized",
      );
      if (!uncategorized) {
        throw new Error("Missing default expense category");
      }
      const transaction = await recordExpense(db, owner);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(950_000n);

      const updated = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id: transaction.id,
        walletId: savingsId,
        categoryId: uncategorized.id,
        amount: 75_050n,
        transactionDate: "2026-09-04",
        note: "Corrected",
      });

      if (!updated.ok) {
        throw new Error(`Expected the edit to save, got ${updated.error.code}`);
      }
      expect(updated.value).toEqual(
        expect.objectContaining({
          id: transaction.id,
          type: "expense",
          amount: 75_050n,
          transactionDate: "2026-09-04",
          note: "Corrected",
          recordedAt: transaction.recordedAt,
          wallet: expect.objectContaining({ id: savingsId }),
          category: expect.objectContaining({ name: "Uncategorized" }),
        }),
      );
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(1_000_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: savingsId }),
      ).toBe(-75_050n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: savingsId,
          asOf: "2026-09-03",
        }),
      ).toBe(0n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "edit",
          before: {
            type: "expense",
            walletId: owner.cashId,
            categoryId: owner.childId,
            amount: "50000",
            transactionDate: "2026-09-02",
            note: "Weekly shop",
          },
          after: {
            type: "expense",
            walletId: savingsId,
            categoryId: uncategorized.id,
            amount: "75050",
            transactionDate: "2026-09-04",
            note: "Corrected",
          },
        }),
      ]);
      // No visible reversal entry: the list still holds exactly one row.
      expect(
        await listTransactions(db, { ownerId: owner.ownerId }),
      ).toHaveLength(1);
    });
  });

  test("saving an edit that changes nothing succeeds without a history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transaction = await recordExpense(db, owner);
      const unchanged = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id: transaction.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      expect(unchanged.ok).toBe(true);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  test("rejected edits change nothing and record no history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const lateId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Late",
        type: "e_wallet",
        openingDate: "2026-09-05",
      });
      const transaction = await recordExpense(db, owner);
      const valid = expenseUpdateInput({ owner, transaction });

      const attempts = [
        [{ ...valid, amount: 0n }, { code: "amount-out-of-range" }],
        [
          { ...valid, amount: 10_000_000_000n },
          { code: "amount-out-of-range" },
        ],
        [{ ...valid, note: "x".repeat(201) }, { code: "note-too-long" }],
        [{ ...valid, transactionDate: "2026-02-30" }, { code: "invalid-date" }],
        [
          { ...valid, transactionDate: "2026-08-31" },
          { code: "before-opening", openingDate: "2026-09-01" },
        ],
        // Moving to a wallet that opened after the transaction's date.
        [
          { ...valid, walletId: lateId },
          { code: "before-opening", openingDate: "2026-09-05" },
        ],
        [
          { ...valid, categoryId: owner.incomeId },
          { code: "category-kind-mismatch" },
        ],
      ] as const;
      for (const [attempt, error] of attempts) {
        expect(await updateTransaction(db, attempt)).toEqual({
          ok: false,
          error,
        });
      }
      await withClock("2026-09-13T16:30:00Z", async () => {
        expect(
          await updateTransaction(db, {
            ...valid,
            transactionDate: "2026-09-14",
          }),
        ).toEqual({
          ok: false,
          error: { code: "future-date", today: "2026-09-13" },
        });
      });

      expect(
        await findTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual(transaction);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  test("another user cannot edit a transaction or attach foreign resources", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const transaction = await recordExpense(db, alice);

      expect(
        await updateTransaction(db, {
          ownerId: bob.ownerId,
          id: transaction.id,
          walletId: bob.cashId,
          categoryId: bob.childId,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      // Bob's own wallet and category cannot be attached to Alice's record,
      // nor can Alice's record be moved onto Bob's wallet.
      expect(
        await updateTransaction(db, {
          ownerId: alice.ownerId,
          id: transaction.id,
          walletId: bob.cashId,
          categoryId: alice.childId,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      expect(
        await updateTransaction(db, {
          ownerId: alice.ownerId,
          id: transaction.id,
          walletId: alice.cashId,
          categoryId: bob.childId,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });

      expect(
        await findTransaction(db, {
          ownerId: alice.ownerId,
          id: transaction.id,
        }),
      ).toEqual(transaction);
      expect(
        await balanceOf({
          db,
          ownerId: alice.ownerId,
          walletId: alice.cashId,
        }),
      ).toBe(950_000n);
    });
  });

  test("edits of a deleted or unknown transaction are not found", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transaction = await recordExpense(db, owner);
      await softDelete(db, transaction.id);
      expect(
        await updateTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await updateTransaction(db, {
          ownerId: owner.ownerId,
          id: "01999999-0000-7000-8000-000000000000",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
    });
  });

  describe("linked refunds", () => {
    /** A ฿500 groceries expense on 2 Sep from the owner's Cash wallet. */
    async function setupExpense(db: Database) {
      const owner = await setupOwner(db);
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `refund-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      if (!created.ok) {
        throw new Error("Expense failed");
      }
      return { ...owner, expense: created.value.transaction };
    }

    function refundInput(
      context: Readonly<{
        ownerId: string;
        cashId: string;
        expense: { id: string };
      }>,
      amount: bigint,
    ) {
      return {
        ownerId: context.ownerId,
        idempotencyKey: `refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: context.cashId,
        categoryId: null,
        refundOfTransactionId: context.expense.id,
        amount,
        transactionDate: "2026-09-03",
        note: "",
      } satisfies CreateTransactionInput;
    }

    test("refund edits exclude their own old amount, keep their link, and follow the expense category", async () => {
      await withRollback(async (db) => {
        const context = await setupExpense(db);
        const { ownerId, cashId, expense } = context;
        const first = await createTransaction(
          db,
          refundInput(context, 30_000n),
        );
        const second = await createTransaction(
          db,
          refundInput(context, 10_000n),
        );
        if (!first.ok || !second.ok) {
          throw new Error("Refunds failed");
        }
        const { id, recordedAt } = first.value.transaction;
        const base = {
          ownerId,
          id,
          walletId: cashId,
          categoryId: null,
          amount: 30_000n,
          transactionDate: "2026-09-03",
          note: "",
        };
        // ฿10,000 is held by the other refund; this refund's own ฿30,000 is free.
        expect(
          await updateTransaction(db, { ...base, amount: 40_001n }),
        ).toEqual({
          ok: false,
          error: { code: "exceeds-refundable", remaining: 40_000n },
        });
        expect(
          await updateTransaction(db, {
            ...base,
            transactionDate: "2026-09-01",
          }),
        ).toEqual({
          ok: false,
          error: { code: "before-expense", expenseDate: "2026-09-02" },
        });
        // A refund edit cannot take a category of its own.
        expect(
          await updateTransaction(db, {
            ...base,
            categoryId: context.childId,
          }),
        ).toEqual({ ok: false, error: { code: "invalid-refund" } });
        const grown = await updateTransaction(db, {
          ...base,
          walletId: context.bankId,
          amount: 40_000n,
          transactionDate: "2026-09-04",
        });
        expect(grown.ok && grown.value).toEqual(
          expect.objectContaining({
            id,
            recordedAt,
            amount: 40_000n,
            wallet: expect.objectContaining({ id: context.bankId }),
            category: expect.objectContaining({ name: "Groceries" }),
            refundOf: expect.objectContaining({ id: expense.id }),
          }),
        );
        expect(await balanceOf({ db, ownerId, walletId: cashId })).toBe(
          960_000n,
        );
        expect(await balanceOf({ db, ownerId, walletId: context.bankId })).toBe(
          40_000n,
        );

        await db
          .update(wallets)
          .set({ archivedAt: new Date() })
          .where(inArray(wallets.id, [context.bankId]));
        // Retaining its own archived wallet is allowed.
        expect(
          (
            await updateTransaction(db, {
              ...base,
              walletId: context.bankId,
              amount: 39_999n,
              transactionDate: "2026-09-04",
            })
          ).ok,
        ).toBe(true);
        expect(await listTransactionChanges(db, { ownerId, id })).toEqual([
          expect.objectContaining({
            action: "edit",
            before: expect.objectContaining({
              type: "refund",
              refundOfTransactionId: expense.id,
              amount: "30000",
            }),
            after: expect.objectContaining({
              walletId: context.bankId,
              amount: "40000",
            }),
          }),
          expect.objectContaining({ action: "edit" }),
        ]);
      });
    });

    test("an expense with refunds cannot shrink below the refunded total, move past a refund, or lose its category's refunds", async () => {
      await withRollback(async (db) => {
        const context = await setupExpense(db);
        const { ownerId, cashId, childId, expense } = context;
        const early = await createTransaction(
          db,
          refundInput(context, 10_000n),
        );
        const late = await createTransaction(db, {
          ...refundInput(context, 5_000n),
          transactionDate: "2026-09-05",
        });
        if (!early.ok || !late.ok) {
          throw new Error("Refunds failed");
        }
        const uncategorized = (await listCategories(db, ownerId)).find(
          (category) =>
            category.kind === "expense" && category.name === "Uncategorized",
        );
        if (!uncategorized) {
          throw new Error("Missing default expense category");
        }
        const base = {
          ownerId,
          id: expense.id,
          walletId: cashId,
          categoryId: childId,
          amount: 50_000n,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
        };
        expect(
          await updateTransaction(db, { ...base, amount: 14_999n }),
        ).toEqual({
          ok: false,
          error: { code: "below-refunded", refundedTotal: 15_000n },
        });
        expect(
          await updateTransaction(db, {
            ...base,
            transactionDate: "2026-09-04",
          }),
        ).toEqual({
          ok: false,
          error: { code: "after-refund", refundDate: "2026-09-03" },
        });

        const corrected = await updateTransaction(db, {
          ...base,
          categoryId: uncategorized.id,
          amount: 15_000n,
          transactionDate: "2026-09-03",
        });
        expect(corrected.ok).toBe(true);
        // Every linked refund now reads the expense's new category.
        expect(
          (await listTransactions(db, { ownerId })).map((item) => [
            item.type,
            item.category?.name,
          ]),
        ).toEqual([
          ["refund", "Uncategorized"],
          ["refund", "Uncategorized"],
          ["expense", "Uncategorized"],
        ]);
        expect(
          await findExpenseRefunds(db, { ownerId, id: expense.id }),
        ).toEqual(
          expect.objectContaining({ refundedTotal: 15_000n, remaining: 0n }),
        );
        expect(
          await listTransactionChanges(db, { ownerId, id: expense.id }),
        ).toEqual([
          expect.objectContaining({
            action: "edit",
            before: expect.objectContaining({ amount: "50000" }),
            after: expect.objectContaining({ amount: "15000" }),
          }),
        ]);
      });
    });
  });

  test("simultaneous edits serialize: every one lands in history and the balance matches the last", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const transaction = await recordExpense(db, owner);
    const amounts = [1_000n, 2_000n, 3_000n, 4_000n, 5_000n];

    const outcomes = await Promise.all(
      amounts.map((amount) =>
        updateTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
        }),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    const history = await listTransactionChanges(db, {
      ownerId: owner.ownerId,
      id: transaction.id,
    });
    expect(history).toHaveLength(5);
    // Each entry starts where the previous one ended.
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index]?.before).toEqual(history[index - 1]?.after);
    }
    const final = await findTransaction(db, {
      ownerId: owner.ownerId,
      id: transaction.id,
    });
    expect(final?.amount).toBe(BigInt(history[4]?.after?.amount ?? "0"));
    expect(
      await balanceOf({
        db,
        ownerId: owner.ownerId,
        walletId: owner.cashId,
      }),
    ).toBe(1_000_000n - (final?.amount ?? 0n));
  });

  test("an expense edit and a refund edit of one expense serialize on the expense and leave the link consistent", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);
    const refund = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `race-refund-${crypto.randomUUID()}`,
      type: "refund",
      walletId: owner.cashId,
      categoryId: null,
      refundOfTransactionId: expense.id,
      amount: 10_000n,
      transactionDate: "2026-09-03",
      note: "",
    });
    if (!refund.ok) {
      throw new Error("Refund failed");
    }

    // Either order ends consistent: ฿300.00 covers the ฿250.00 refund, and
    // ฿250.00 fits inside whatever the expense currently is.
    const [shrunk, grown] = await Promise.all([
      updateTransaction(db, {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 30_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      }),
      updateTransaction(db, {
        ownerId: owner.ownerId,
        id: refund.value.transaction.id,
        walletId: owner.cashId,
        categoryId: null,
        amount: 25_000n,
        transactionDate: "2026-09-03",
        note: "",
      }),
    ]);

    expect(shrunk.ok).toBe(true);
    expect(grown.ok).toBe(true);
    const refunds = await findExpenseRefunds(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    expect(refunds).toEqual(
      expect.objectContaining({
        refundedTotal: 25_000n,
        remaining: 5_000n,
        refunds: [
          expect.objectContaining({
            id: refund.value.transaction.id,
            amount: 25_000n,
          }),
        ],
      }),
    );
  });

  test("an edit may retain its own archived wallets but not move to a different archived one", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const transaction = await recordExpense(db, owner);
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.cashId));
      const retained = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id: transaction.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 200n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      expect(retained.ok && retained.value.wallet).toEqual(
        expect.objectContaining({ id: owner.cashId, archived: true }),
      );

      const otherId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Other",
        type: "cash",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, otherId));
      expect(
        await updateTransaction(db, {
          ownerId: owner.ownerId,
          id: transaction.id,
          walletId: otherId,
          categoryId: owner.childId,
          amount: 200n,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: otherId },
      });
    });
  });

  test("a transfer edit retains or swaps its own archived wallets but rejects a different archived destination", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `retained-transfer-${crypto.randomUUID()}`,
        type: "transfer",
        currency: "THB",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      const id = created.value.transaction.id;
      const otherId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Other",
        type: "cash",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(inArray(wallets.id, [owner.cashId, owner.bankId, otherId]));

      const kept = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        currency: "THB",
        amount: 200n,
        transactionDate: "2026-09-05",
        note: "",
      });
      expect(kept.ok).toBe(true);
      const swapped = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.bankId,
        destinationWalletId: owner.cashId,
        categoryId: null,
        currency: "THB",
        amount: 300n,
        transactionDate: "2026-09-05",
        note: "",
      });
      expect(swapped.ok).toBe(true);
      expect(
        await updateTransaction(db, {
          ownerId: owner.ownerId,
          id,
          walletId: owner.cashId,
          destinationWalletId: otherId,
          categoryId: null,
          currency: "THB",
          amount: 300n,
          transactionDate: "2026-09-05",
          note: "",
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: otherId },
      });
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(1_000_300n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.bankId,
        }),
      ).toBe(-300n);
    });
  });

  test("a failed history write rolls the financial update back and leaves no history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "rollback-transfer",
        type: "transfer",
        currency: "THB",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      const id = created.value.transaction.id;
      // Inject a storage fault at the audit boundary, after the financial
      // update. DDL lives in this rolled-back test transaction and never
      // touches application databases.
      await db.execute(
        sql`alter table transaction_changes add constraint fail_update_history check (transaction_id is null) not valid`,
      );
      await expect(
        updateTransaction(db, {
          ownerId: owner.ownerId,
          id,
          walletId: owner.cashId,
          destinationWalletId: owner.bankId,
          categoryId: null,
          currency: "THB",
          amount: 200_000n,
          transactionDate: "2026-09-05",
          note: "",
        }),
      ).rejects.toThrow();
      expect(await findTransaction(db, { ownerId: owner.ownerId, id })).toEqual(
        created.value.transaction,
      );
      expect(
        await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
      ).toEqual([]);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
        }),
      ).toBe(900_000n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.bankId,
        }),
      ).toBe(100_000n);

      await db.execute(
        sql`alter table transaction_changes drop constraint fail_update_history`,
      );
      const recovered = await updateTransaction(db, {
        ownerId: owner.ownerId,
        id,
        walletId: owner.bankId,
        destinationWalletId: owner.cashId,
        categoryId: null,
        currency: "THB",
        amount: 100_000n,
        transactionDate: "2026-09-05",
        note: "",
      });
      expect(recovered.ok).toBe(true);
    });
  });
});

describe("deleteTransaction", () => {
  test("removing an income or expense clears its effects from lists, detail, and balances, and keeps one delete entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-income-${crypto.randomUUID()}`,
        type: "income",
        walletId: owner.bankId,
        categoryId: owner.incomeId,
        amount: 30_000n,
        transactionDate: "2026-09-03",
        note: "Salary",
      });
      if (!income.ok) {
        throw new Error("Expected the income to save");
      }
      const incomeId = income.value.transaction.id;
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(30_000n);

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toBeNull();
      expect(
        (await listTransactions(db, { ownerId: owner.ownerId })).map(
          (transaction) => transaction.id,
        ),
      ).toEqual([incomeId]);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(1_000_000n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.ownerId,
          walletId: owner.cashId,
          asOf: "2026-09-02",
        }),
      ).toBe(1_000_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({ amount: "50000" }),
          after: null,
        }),
      ]);

      // Repeating the deletion is the same outcome, without new history.
      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toHaveLength(1);

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: incomeId }),
      ).toEqual({
        ok: true,
        value: { id: incomeId },
      });
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(0n);
    });
  });

  test("a late create retry after a deletion confirms the original outcome without recreating it", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "delete-retry",
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      } satisfies CreateTransactionInput;
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Expected the expense to save");
      }
      await deleteTransaction(db, {
        ownerId: owner.ownerId,
        id: created.value.transaction.id,
      });

      const retry = await createTransaction(db, input);
      expect(retry).toEqual({
        ok: true,
        value: { transaction: created.value.transaction, replayed: true },
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(1_000_000n);
    });
  });

  test("deleting a transfer removes both wallet effects and retains history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const created = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-transfer-${crypto.randomUUID()}`,
        type: "transfer",
        currency: "THB",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-02",
        note: "Move money",
      });
      if (!created.ok) {
        throw new Error("Expected the transfer to save");
      }
      const id = created.value.transaction.id;

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id }),
      ).toEqual({ ok: true, value: { id } });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
      expect(
        await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({
            type: "transfer",
            destinationWalletId: owner.bankId,
            amount: "100000",
          }),
          after: null,
        }),
      ]);
    });
  });

  test("deleting a refund removes its effect and restores the expense's refundable remainder", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const refund = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `delete-refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 20_000n,
        transactionDate: "2026-09-03",
        note: "Returned",
      });
      if (!refund.ok) {
        throw new Error("Expected the refund to save");
      }
      const refundId = refund.value.transaction.id;

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: refundId }),
      ).toEqual({ ok: true, value: { id: refundId } });
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual({ refunds: [], refundedTotal: 0n, remaining: 50_000n });
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(0n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: refundId,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({
            type: "refund",
            refundOfTransactionId: expense.id,
            amount: "20000",
          }),
          after: null,
        }),
      ]);
    });
  });

  test("an expense with linked refunds stays and is refused with the refunds until they are gone", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const first = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `guard-refund-1-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-03",
        note: "",
      });
      const second = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `guard-refund-2-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 5_000n,
        transactionDate: "2026-09-05",
        note: "",
      });
      if (!first.ok || !second.ok) {
        throw new Error("Expected both refunds to save");
      }
      const refundIds = [
        first.value.transaction.id,
        second.value.transaction.id,
      ];

      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({
        ok: false,
        error: {
          code: "refunds-exist",
          refunds: [
            expect.objectContaining({
              amount: 10_000n,
              transactionDate: "2026-09-03",
            }),
            expect.objectContaining({
              amount: 5_000n,
              transactionDate: "2026-09-05",
            }),
          ],
        },
      });
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
      ).toBe(15_000n);

      for (const id of refundIds) {
        expect(
          await deleteTransaction(db, { ownerId: owner.ownerId, id }),
        ).toEqual({ ok: true, value: { id } });
      }
      expect(
        await deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
    });
  });

  test("another owner's and unknown transactions are not found", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const expense = await recordExpense(db, alice);

      expect(
        await deleteTransaction(db, { ownerId: bob.ownerId, id: expense.id }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await deleteTransaction(db, {
          ownerId: bob.ownerId,
          id: "01999999-0000-7000-8000-000000000000",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await findTransaction(db, { ownerId: alice.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await balanceOf({ db, ownerId: alice.ownerId, walletId: alice.cashId }),
      ).toBe(950_000n);
    });
  });

  test("a failed history write rolls the soft deletion back and leaves no partial effect", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      // Inject a storage fault at the audit boundary, after the soft
      // deletion. DDL lives in this rolled-back test transaction and never
      // touches application databases.
      await db.execute(
        sql`alter table transaction_changes add constraint fail_delete_history check (transaction_id is null) not valid`,
      );
      await expect(
        deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).rejects.toThrow();

      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
      ).toBe(950_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
    });
  });

  test("a refund deletion and an expense reduction serialize so the committed records stay consistent", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);
    const refund = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `race-refund-${crypto.randomUUID()}`,
      type: "refund",
      walletId: owner.bankId,
      categoryId: null,
      refundOfTransactionId: expense.id,
      amount: 35_000n,
      transactionDate: "2026-09-03",
      note: "",
    });
    if (!refund.ok) {
      throw new Error("Expected the refund to save");
    }

    const [deleted, reduced] = await Promise.all([
      deleteTransaction(db, {
        ownerId: owner.ownerId,
        id: refund.value.transaction.id,
      }),
      updateTransaction(db, {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 15_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      }),
    ]);

    expect(deleted.ok).toBe(true);
    const summary = await findExpenseRefunds(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    const current = await findTransaction(db, {
      ownerId: owner.ownerId,
      id: expense.id,
    });
    expect(summary?.refundedTotal).toBe(0n);
    expect(current?.amount).toBe(reduced.ok ? 15_000n : 50_000n);
    expect(
      await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.cashId }),
    ).toBe(1_000_000n - (current?.amount ?? 0n));
    expect(
      await balanceOf({ db, ownerId: owner.ownerId, walletId: owner.bankId }),
    ).toBe(0n);
  });

  test("an expense deletion and a competing refund creation serialize on the locked expense", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const expense = await recordExpense(db, owner);

    const [deleted, refunded] = await Promise.all([
      deleteTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `race-refund-2-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-03",
        note: "",
      }),
    ]);

    // Either the expense goes first and the refund cannot link to it, or the
    // refund lands first and the expense stays to cover it.
    if (deleted.ok) {
      expect(refunded).toEqual({
        ok: false,
        error: { code: "expense-not-found" },
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
    } else {
      expect(refunded.ok).toBe(true);
      if (!refunded.ok) {
        throw new Error("Expected the competing refund to save");
      }
      expect(deleted).toEqual({
        ok: false,
        error: {
          code: "refunds-exist",
          refunds: [
            expect.objectContaining({ id: refunded.value.transaction.id }),
          ],
        },
      });
      expect(
        await findTransaction(db, { ownerId: owner.ownerId, id: expense.id }),
      ).toEqual(expense);
      expect(
        await findExpenseRefunds(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 10_000n, remaining: 40_000n }),
      );
    }
  });
});
