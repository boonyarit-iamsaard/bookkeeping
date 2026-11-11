import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { rejected } from "../shared/rejection";
import {
  insertWallet,
  recordExpense,
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

  test("a rejected command saves nothing and leaves its key free", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const input = {
        ownerId: owner.ownerId,
        idempotencyKey: "invalid-calendar-date",
        type: "expense" as const,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      };
      expect(
        await createTransaction(db, {
          ...input,
          transactionDate: "2026-02-30",
        }),
      ).toEqual({
        ok: false,
        error: rejected({ field: "transactionDate", code: "invalid-date" }),
      });
      expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual(
        [],
      );
      const corrected = await createTransaction(db, input);
      expect(corrected.ok && corrected.value.replayed).toBe(false);
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
      expect(refunds?.refundAllowance).toBe(0n);
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
      expect(refunds?.refundAllowance).toBe(1_300n);
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
      ...Array.from({ length: 2 }, () =>
        rejected({
          field: "amount",
          code: "exceeds-refundable",
          refundAllowance: 0n,
        }),
      ),
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

  test("exact bounds are recorded without rounding", async () => {
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
      const [summary] = await listWallets(db, { ownerId: owner.ownerId });
      expect(summary?.balance).toBe(1_000_000n - 1n - 9_999_999_999n);
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
          error: rejected({ field: "transactionDate", code: "future-date" }),
        });
        expect((await attemptOn("2026-09-14")).ok).toBe(true);
      });
      // 16:30 UTC is still 23:30 on 13 Sep in Bangkok.
      await withClock("2026-09-13T16:30:00Z", async () => {
        expect(await attemptOn("2026-09-14")).toEqual({
          ok: false,
          error: rejected({ field: "transactionDate", code: "future-date" }),
        });
      });
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

  test("a refund lands in its receiving wallet on its own date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const bank = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Bank",
        type: "bank_account",
        openingDate: "2026-09-04",
      });
      const refund = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: bank,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-04",
        note: "",
      });
      expect(refund.ok).toBe(true);
      expect(
        (await listWallets(db, { ownerId: owner.ownerId })).map(
          (w) => w.balance,
        ),
      ).toEqual([950_000n, 0n, 10_000n]);
      expect(
        (
          await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-03" })
        ).map((w) => w.balance),
      ).toEqual([950_000n, 0n]);
    });
  });
});
