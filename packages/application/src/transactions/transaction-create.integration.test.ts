import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { setupOwner, softDelete } from "../testing/transaction-suite-fixture";
import { listWallets } from "../wallets/wallet";
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
