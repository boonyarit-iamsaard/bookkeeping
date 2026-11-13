import { setupTestDatabase } from "@bookkeeping/database/testing";
import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { rejected } from "../shared/rejection";
import {
  recordExpense,
  setupOwner,
  withClock,
} from "../testing/transaction-suite-fixture";
import { createWalletForTest } from "../testing/wallet-fixture";
import { listWallets } from "../wallets/wallet";
import type { CreateTransactionInput } from "./transaction";
import { createTransaction } from "./transaction";
import { findExpenseRefunds, listTransactions } from "./transaction-reads";

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
      expect(expense.value).toEqual(
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
      expect(income.value.category).toEqual(
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
      expect(corrected.ok).toBe(true);
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
        value: expect.objectContaining({
          type: "transfer",
          amount: 12_345n,
          wallet: expect.objectContaining({ id: owner.cashId }),
          destinationWallet: expect.objectContaining({ id: owner.bankId }),
          category: null,
          refundOf: null,
        }),
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
        refundOfTransactionId: expense.value.id,
        amount: 2_000n,
        transactionDate: "2026-09-03",
        note: "Returned",
      });

      expect(created).toEqual({
        ok: true,
        value: expect.objectContaining({
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
            id: expense.value.id,
            amount: 2_000n,
            transactionDate: "2026-09-02",
          },
        }),
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
        id: expense.value.id,
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
      const expenseId = expense.value.id;
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
          refundOfTransactionId: expense.value.id,
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

      expect(expense.ok).toBe(true);
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
      expect(smallest.ok && smallest.value.amount).toBe(1n);
      expect(largest.ok && largest.value.amount).toBe(9_999_999_999n);
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
      const { recordedAt, transactionDate } = saved.value;
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
      expect(retry.value).toEqual(first.value);
      expect(intentional.value.id).not.toBe(first.value.id);
      expect(
        await listTransactions(db, { ownerId: owner.ownerId }),
      ).toHaveLength(2);
      const [summary] = await listWallets(db, { ownerId: owner.ownerId });
      expect(summary?.balance).toBe(976_000n);
    });
  });

  test("one transfer subtracts from its source and adds to its destination on its date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const { id: destination } = await createWalletForTest(db, {
        ownerId: owner.ownerId,
        name: "Bank",
        type: "bank_account",
        openingAmount: 0n,
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
      expect(created.ok).toBe(true);
    });
  });

  test("a refund lands in its receiving wallet on its own date", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      const { id: bank } = await createWalletForTest(db, {
        ownerId: owner.ownerId,
        name: "Bank",
        type: "bank_account",
        openingAmount: 0n,
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
