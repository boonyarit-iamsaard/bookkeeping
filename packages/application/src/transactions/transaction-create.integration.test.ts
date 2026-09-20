import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  insertWallet,
  setupOwner,
  softDelete,
  withClock,
} from "../testing/transaction-suite-fixture";
import { listWallets } from "../wallets/wallet";
import type { CreateTransactionInput } from "./transaction";
import {
  createTransaction,
  findExpenseRefunds,
  findTransaction,
  listTransactions,
} from "./transaction";

const { withRollback, committed } = setupTestDatabase();

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
      ).toEqual({
        ok: false,
        error: { field: "transactionDate", code: "invalid-date" },
      });
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
      ).toEqual({
        ok: false,
        error: { field: "amount", code: "amount-out-of-range" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "long-note",
          note: "x".repeat(201),
        }),
      ).toEqual({ ok: false, error: { field: "note", code: "note-too-long" } });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "future-date",
          transactionDate: "2999-01-01",
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "transactionDate",
          code: "future-date",
          today: expect.any(String),
        },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "before-opening",
          transactionDate: "2026-08-31",
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "transactionDate",
          code: "before-opening",
          openingDate: "2026-09-01",
        },
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
      ).toEqual({
        ok: false,
        error: { field: "walletId", code: "wallet-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "foreign-category",
          categoryId: foreign.childId,
        }),
      ).toEqual({
        ok: false,
        error: { field: "categoryId", code: "category-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "wrong-category-tree",
          categoryId: owner.incomeId,
        }),
      ).toEqual({
        ok: false,
        error: { field: "categoryId", code: "category-kind-mismatch" },
      });

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
        error: {
          field: "walletId",
          code: "wallet-archived",
          walletId: owner.cashId,
        },
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
      ).toEqual({
        ok: false,
        error: { field: "destinationWalletId", code: "same-wallet" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-category",
          categoryId: owner.childId,
        }),
      ).toEqual({
        ok: false,
        error: { field: "type", code: "invalid-transfer" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-missing-destination",
          destinationWalletId: null,
        }),
      ).toEqual({
        ok: false,
        error: { field: "type", code: "invalid-transfer" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-foreign-source",
          walletId: foreign.cashId,
        }),
      ).toEqual({
        ok: false,
        error: { field: "walletId", code: "wallet-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "transfer-foreign-destination",
          destinationWalletId: foreign.bankId,
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "destinationWalletId",
          code: "destination-wallet-not-found",
        },
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
        error: {
          field: "walletId",
          code: "wallet-archived",
          walletId: owner.cashId,
        },
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
        error: {
          field: "destinationWalletId",
          code: "wallet-archived",
          walletId: owner.bankId,
        },
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
        error: {
          field: "transactionDate",
          code: "before-opening",
          openingDate: "2026-09-03",
        },
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
        error: {
          field: "transactionDate",
          code: "before-opening",
          openingDate: "2026-09-03",
        },
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
        error: {
          field: "amount",
          code: "exceeds-refundable",
          remaining: 2_000n,
        },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-before-expense",
          transactionDate: "2026-09-01",
        }),
      ).toEqual({
        ok: false,
        error: {
          field: "transactionDate",
          code: "before-expense",
          expenseDate: "2026-09-02",
        },
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
        error: {
          field: "transactionDate",
          code: "before-opening",
          openingDate: "2026-09-04",
        },
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
      ).toEqual({
        ok: false,
        error: { field: "refundOfTransactionId", code: "expense-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-foreign-expense",
          refundOfTransactionId: foreignExpense.value.transaction.id,
        }),
      ).toEqual({
        ok: false,
        error: { field: "refundOfTransactionId", code: "expense-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-income-link",
          refundOfTransactionId: income.value.transaction.id,
        }),
      ).toEqual({
        ok: false,
        error: { field: "refundOfTransactionId", code: "expense-not-found" },
      });
      expect(
        await createTransaction(db, {
          ...base,
          idempotencyKey: "refund-foreign-wallet",
          walletId: foreign.bankId,
        }),
      ).toEqual({
        ok: false,
        error: { field: "walletId", code: "wallet-not-found" },
      });

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
        error: {
          field: "walletId",
          code: "wallet-archived",
          walletId: owner.bankId,
        },
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
      { field: "amount", code: "exceeds-refundable", remaining: 0n },
      { field: "amount", code: "exceeds-refundable", remaining: 0n },
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

  test("an expense subtracts and income adds to the wallet's derived balance", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);

      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `balance-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `balance-income-${crypto.randomUUID()}`,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        amount: 100_000n,
        transactionDate: "2026-09-03",
        note: "",
      });

      expect(expense.ok && expense.value.replayed).toBe(false);
      expect(income.ok).toBe(true);
      const [summary] = await listWallets(db, { ownerId: owner.ownerId });
      expect(summary?.balance).toBe(1_050_000n);

      const listed = await listTransactions(db, { ownerId: owner.ownerId });
      expect(listed.map((t) => [t.type, t.amount, t.transactionDate])).toEqual([
        ["income", 100_000n, "2026-09-03"],
        ["expense", 50_000n, "2026-09-02"],
      ]);
      expect(listed[1]).toEqual(
        expect.objectContaining({
          note: "Weekly shop",
          wallet: expect.objectContaining({ name: "Cash", type: "cash" }),
          category: expect.objectContaining({
            name: "Groceries",
            parentName: "Food & Drink",
          }),
          recordedAt: expect.any(Date),
        }),
      );
    });
  });

  test("balances can go negative and backdated entries land on their own date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `backdated-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 1_500_000n,
        transactionDate: "2026-09-05",
        note: "",
      });

      const [onOpeningDay] = await listWallets(db, {
        ownerId: owner.ownerId,
        asOf: "2026-09-04",
      });
      const [afterExpense] = await listWallets(db, {
        ownerId: owner.ownerId,
        asOf: "2026-09-05",
      });
      expect(onOpeningDay?.balance).toBe(1_000_000n);
      expect(afterExpense?.balance).toBe(-500_000n);
    });
  });

  test("exact bounds are accepted and out-of-range amounts are rejected without rounding", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      function attempt(amount: bigint) {
        return createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `bound-${crypto.randomUUID()}`,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount,
          transactionDate: "2026-09-02",
          note: "",
        });
      }

      const smallest = await attempt(1n);
      const largest = await attempt(9_999_999_999n);
      expect(smallest.ok && smallest.value.transaction.amount).toBe(1n);
      expect(largest.ok && largest.value.transaction.amount).toBe(
        9_999_999_999n,
      );
      for (const amount of [0n, -1n, 10_000_000_000n]) {
        const rejected = await attempt(amount);
        expect(rejected).toEqual({
          ok: false,
          error: { field: "amount", code: "amount-out-of-range" },
        });
      }
      const [summary] = await listWallets(db, { ownerId: owner.ownerId });
      expect(summary?.balance).toBe(1_000_000n - 1n - 9_999_999_999n);
    });
  });

  test("a note over 200 characters is rejected", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const rejected = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `long-note-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "x".repeat(201),
      });
      expect(rejected).toEqual({
        ok: false,
        error: { field: "note", code: "note-too-long" },
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
    });
  });

  test("Bangkok midnight decides which dates are in the future", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      function attemptOn(date: string) {
        return createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `future-${crypto.randomUUID()}`,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 100n,
          transactionDate: date,
          note: "",
        });
      }
      // 17:30 UTC on 13 Sep is already 00:30 on 14 Sep in Bangkok.
      await withClock("2026-09-13T17:30:00Z", async () => {
        expect(await attemptOn("2026-09-15")).toEqual({
          ok: false,
          error: {
            field: "transactionDate",
            code: "future-date",
            today: "2026-09-14",
          },
        });
        expect((await attemptOn("2026-09-14")).ok).toBe(true);
      });
      // 16:30 UTC is still 23:30 on 13 Sep in Bangkok.
      await withClock("2026-09-13T16:30:00Z", async () => {
        expect(await attemptOn("2026-09-14")).toEqual({
          ok: false,
          error: {
            field: "transactionDate",
            code: "future-date",
            today: "2026-09-13",
          },
        });
      });
    });
  });

  test("the opening day is allowed and the day before it is rejected by name", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      function attemptOn(date: string) {
        return createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `opening-${crypto.randomUUID()}`,
          type: "income",
          walletId: owner.cashId,
          categoryId: owner.incomeId,
          amount: 100n,
          transactionDate: date,
          note: "",
        });
      }
      expect((await attemptOn("2026-09-01")).ok).toBe(true);
      expect(await attemptOn("2026-08-31")).toEqual({
        ok: false,
        error: {
          field: "transactionDate",
          code: "before-opening",
          openingDate: "2026-09-01",
        },
      });
    });
  });

  test("another user's wallet, category, and transactions are not found", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const saved = await createTransaction(db, {
        ownerId: alice.ownerId,
        idempotencyKey: `owner-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: alice.cashId,
        categoryId: alice.childId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      });
      if (!saved.ok) {
        throw new Error("Expected Alice's expense to save");
      }

      expect(
        await createTransaction(db, {
          ownerId: bob.ownerId,
          idempotencyKey: `foreign-wallet-${crypto.randomUUID()}`,
          type: "expense",
          walletId: alice.cashId,
          categoryId: bob.childId,
          amount: 100n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({
        ok: false,
        error: { field: "walletId", code: "wallet-not-found" },
      });
      expect(
        await createTransaction(db, {
          ownerId: bob.ownerId,
          idempotencyKey: `foreign-category-${crypto.randomUUID()}`,
          type: "expense",
          walletId: bob.cashId,
          categoryId: alice.childId,
          amount: 100n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({
        ok: false,
        error: { field: "categoryId", code: "category-not-found" },
      });
      expect(
        await findTransaction(db, {
          ownerId: bob.ownerId,
          id: saved.value.transaction.id,
        }),
      ).toBeNull();
      expect(await listTransactions(db, { ownerId: bob.ownerId })).toEqual([]);
      const [aliceWallet] = await listWallets(db, { ownerId: alice.ownerId });
      expect(aliceWallet?.balance).toBe(999_900n);
    });
  });

  test("the recording time is the server instant, separate from the transaction date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const before = new Date();
      const saved = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `recording-instant-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 100n,
        transactionDate: "2026-09-01",
        note: "",
      });
      if (!saved.ok) {
        throw new Error("Expected the expense to save");
      }
      const { recordedAt, transactionDate } = saved.value.transaction;
      expect(transactionDate).toBe("2026-09-01");
      expect(recordedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
      expect(recordedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });

  test("the same key and payload saves once; distinct keys allow identical records", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `receipt-${crypto.randomUUID()}`,
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      };

      const first = await createTransaction(db, input);
      const retry = await createTransaction(db, input);
      const intentional = await createTransaction(db, {
        ...input,
        idempotencyKey: `receipt-${crypto.randomUUID()}`,
      });

      if (!first.ok || !retry.ok || !intentional.ok) {
        throw new Error("Expected all three submissions to succeed");
      }
      expect(retry.value.replayed).toBe(true);
      expect(retry.value.transaction.id).toBe(first.value.transaction.id);
      expect(intentional.value.transaction.id).not.toBe(
        first.value.transaction.id,
      );
      expect(
        await listTransactions(db, { ownerId: owner.ownerId }),
      ).toHaveLength(2);
      const [summary] = await listWallets(db, { ownerId: owner.ownerId });
      expect(summary?.balance).toBe(976_000n);
    });
  });

  test("the same key with a changed payload conflicts and changes nothing", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `conflict-${crypto.randomUUID()}`,
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_000n,
        transactionDate: "2026-09-02",
        note: "",
      };
      await createTransaction(db, input);

      const changed = await createTransaction(db, {
        ...input,
        amount: 13_000n,
      });

      expect(changed).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      const listed = await listTransactions(db, { ownerId: owner.ownerId });
      expect(listed.map((t) => t.amount)).toEqual([12_000n]);
    });
  });

  test("simultaneous submissions with the same key commit exactly one transaction", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const input = {
      ownerId: owner.ownerId,
      idempotencyKey: `submission-race-${crypto.randomUUID()}`,
      type: "expense" as const,
      walletId: owner.cashId,
      categoryId: owner.childId,
      amount: 50_000n,
      transactionDate: "2026-09-02",
      note: "Race",
    };

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => createTransaction(db, input)),
    );

    const ids = new Set<string>();
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        throw new Error(`Unexpected rejection ${outcome.error.code}`);
      }
      ids.add(outcome.value.transaction.id);
    }
    expect(ids.size).toBe(1);
    expect(outcomes.filter((o) => o.ok && !o.value.replayed)).toHaveLength(1);
    expect(await listTransactions(db, { ownerId: owner.ownerId })).toHaveLength(
      1,
    );
    const [summary] = await listWallets(db, { ownerId: owner.ownerId });
    expect(summary?.balance).toBe(950_000n);
  });

  test("one transfer subtracts from its source and adds to its destination on its date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const destination = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Bank",
        type: "bank_account",
        openingDate: "2026-09-02",
      });
      const result = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `transfer-dated-${crypto.randomUUID()}`,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: destination,
        categoryId: null,
        amount: 1_500_001n,
        transactionDate: "2026-09-02",
        note: "Move savings",
      });
      expect(result.ok).toBe(true);
      expect(
        await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-01" }),
      ).toEqual([
        expect.objectContaining({ balance: 1_000_000n }),
        expect.objectContaining({ balance: 0n }),
        expect.objectContaining({ balance: 0n }),
      ]);
      expect(
        await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-02" }),
      ).toEqual([
        expect.objectContaining({ balance: -500_001n }),
        expect.objectContaining({ balance: 0n }),
        expect.objectContaining({ balance: 1_500_001n }),
      ]);
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual([
        expect.objectContaining({
          type: "transfer",
          category: null,
          wallet: expect.objectContaining({ id: owner.cashId }),
          destinationWallet: expect.objectContaining({ id: destination }),
        }),
      ]);
    });
  });

  test("transfer validation rejects same wallets, foreign wallets, missing currency, and dates outside either wallet's history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const late = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Late",
        type: "bank_account",
        openingDate: "2026-09-05",
      });
      const foreign = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: `transfer-check-${crypto.randomUUID()}`,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: late,
        categoryId: null,
        amount: 100n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      for (const [changes, code] of [
        [{ destinationWalletId: owner.cashId }, "same-wallet"],
        [
          { destinationWalletId: foreign.bankId },
          "destination-wallet-not-found",
        ],
        [{ walletId: foreign.cashId }, "wallet-not-found"],
        [{ transactionDate: "2026-09-04" }, "before-opening"],
        [
          {
            walletId: late,
            destinationWalletId: owner.cashId,
            transactionDate: "2026-09-04",
          },
          "before-opening",
        ],
        [{ transactionDate: "9999-01-01" }, "future-date"],
        [{ amount: 0n }, "amount-out-of-range"],
        [{ amount: 10_000_000_000n }, "amount-out-of-range"],
        [{ categoryId: foreign.childId }, "invalid-transfer"],
      ] as const) {
        expect(await createTransaction(db, { ...input, ...changes })).toEqual({
          ok: false,
          error: expect.objectContaining({ code }),
        });
      }
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([1_000_000n, 0n, 0n]);
    });
  });

  test("simultaneous duplicate transfers commit one pair of effects and changed destinations conflict", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const input = {
      ownerId: owner.ownerId,
      idempotencyKey: `transfer-race-${crypto.randomUUID()}`,
      type: "transfer",
      walletId: owner.cashId,
      destinationWalletId: owner.bankId,
      categoryId: null,
      amount: 9_999_999_999n,
      transactionDate: "2026-09-05",
      note: "",
    } satisfies CreateTransactionInput;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createTransaction(db, input)),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    expect(
      results.filter((result) => result.ok && !result.value.replayed),
    ).toHaveLength(1);
    expect(await listTransactions(db, { ownerId: owner.ownerId })).toHaveLength(
      1,
    );
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map((w) => w.balance),
    ).toEqual([-9_998_999_999n, 9_999_999_999n]);
    expect(
      await createTransaction(db, {
        ...input,
        walletId: owner.bankId,
        destinationWalletId: owner.cashId,
      }),
    ).toEqual({ ok: false, error: { code: "idempotency-conflict" } });
    const again = await createTransaction(db, {
      ...input,
      idempotencyKey: `transfer-race-${crypto.randomUUID()}`,
    });
    expect(again.ok && again.value.replayed).toBe(false);
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map((w) => w.balance),
    ).toEqual([-19_998_999_998n, 19_999_999_998n]);
  });

  test("receipt or history write failures roll back both transfer effects and leave no partial receipt or history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "fail-transfer-receipt",
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 100_000n,
        transactionDate: "2026-09-05",
        note: "",
      } satisfies CreateTransactionInput;
      // Inject a storage fault at the receipt boundary, after the financial insert.
      // DDL lives in this rolled-back test transaction and never touches app databases.
      await db.execute(
        sql`alter table creation_receipts add constraint fail_transfer_receipt check (key <> 'fail-transfer-receipt')`,
      );
      await expect(createTransaction(db, input)).rejects.toThrow();
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([1_000_000n, 0n]);
      await db.execute(
        sql`alter table creation_receipts drop constraint fail_transfer_receipt`,
      );
      const created = await createTransaction(db, input);
      if (!created.ok) {
        throw new Error("Transfer failed after storage recovered");
      }
      expect(created.value.replayed).toBe(false);
    });
  });

  test("refund rules: dates follow the expense and receiving opening, wallets may differ but not be archived, and links must be the owner's own expense", async () => {
    await withRollback(async (db) => {
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
      const expense = created.value.transaction;
      const bank = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Bank",
        type: "bank_account",
        openingDate: "2026-09-04",
      });
      const retired = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Retired",
        type: "cash",
        openingDate: "2026-09-01",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, retired));
      const foreignOwner = await setupOwner(db);
      const foreignExpense = await createTransaction(db, {
        ownerId: foreignOwner.ownerId,
        idempotencyKey: `refund-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: foreignOwner.cashId,
        categoryId: foreignOwner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      if (!foreignExpense.ok) {
        throw new Error("Foreign expense failed");
      }
      const income = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `refund-income-${crypto.randomUUID()}`,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.incomeId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      });
      function refundInput(amount: bigint) {
        return {
          ownerId: owner.ownerId,
          idempotencyKey: `refund-${crypto.randomUUID()}`,
          type: "refund",
          walletId: owner.cashId,
          categoryId: null,
          refundOfTransactionId: expense.id,
          amount,
          transactionDate: "2026-09-03" as const,
          note: "",
        } satisfies CreateTransactionInput;
      }
      const base = refundInput(10_000n);
      for (const [changes, error] of [
        [
          { transactionDate: "2026-09-01" },
          {
            field: "transactionDate",
            code: "before-expense",
            expenseDate: "2026-09-02",
          },
        ],
        [
          { walletId: bank, transactionDate: "2026-09-03" },
          {
            field: "transactionDate",
            code: "before-opening",
            openingDate: "2026-09-04",
          },
        ],
        [
          { transactionDate: "9999-01-01" },
          { field: "transactionDate", code: "future-date" },
        ],
        [{ walletId: retired }, { field: "walletId", code: "wallet-archived" }],
        [
          { walletId: foreignOwner.cashId },
          { field: "walletId", code: "wallet-not-found" },
        ],
        [
          { refundOfTransactionId: foreignExpense.value.transaction.id },
          { field: "refundOfTransactionId", code: "expense-not-found" },
        ],
        [
          {
            refundOfTransactionId: income.ok ? income.value.transaction.id : "",
          },
          { field: "refundOfTransactionId", code: "expense-not-found" },
        ],
        [
          { refundOfTransactionId: null },
          { field: "type", code: "invalid-refund" },
        ],
        [
          { categoryId: owner.childId },
          { field: "type", code: "invalid-refund" },
        ],
        [
          { type: "expense" as const, categoryId: owner.childId },
          { field: "type", code: "invalid-refund" },
        ],
        [{ amount: 0n }, { field: "amount", code: "amount-out-of-range" }],
      ] as const) {
        expect(await createTransaction(db, { ...base, ...changes })).toEqual({
          ok: false,
          error: expect.objectContaining(error),
        });
      }
      // Foreign owners cannot see the expense's refunds at all.
      expect(
        await findExpenseRefunds(db, {
          ownerId: foreignOwner.ownerId,
          id: expense.id,
        }),
      ).toBeNull();

      const differentWallet = await createTransaction(db, {
        ...base,
        idempotencyKey: `refund-${crypto.randomUUID()}`,
        walletId: bank,
        transactionDate: "2026-09-04",
      });
      expect(differentWallet.ok).toBe(true);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([950_100n, 0n, 10_000n, 0n]);
      expect(
        await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-03" }),
      ).toEqual([
        expect.objectContaining({ balance: 950_100n }),
        expect.objectContaining({ balance: 0n }),
        expect.objectContaining({ balance: 0n }),
        expect.objectContaining({ balance: 0n }),
      ]);
    });
  });
});
