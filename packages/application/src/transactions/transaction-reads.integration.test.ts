import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import {
  listCategories,
  removeCategory,
  updateCategory,
} from "../categories/category";
import { insertTransaction } from "../testing/transaction-fixture";
import {
  recordExpense,
  setupOwner,
  softDelete,
  withClock,
} from "../testing/transaction-suite-fixture";
import {
  listWallets,
  replaceWalletOpening,
  setWalletArchived,
} from "../wallets/wallet";
import {
  createTransaction,
  deleteTransaction,
  findExpenseRefunds,
  findLastUsedWalletId,
  findReplayedTransaction,
  findTransaction,
  getMonthlySummary,
  listTransactionChanges,
  listTransactionPage,
  listTransactions,
  updateTransaction,
} from "./transaction";

const { withRollback } = setupTestDatabase();

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

describe("getMonthlySummary", () => {
  test("totals use financial dates, own-month refunds, and exact satang independently of transfers", async () => {
    await withClock("2026-09-30T17:00:00Z", async () => {
      await withRollback(async (db) => {
        const owner = await setupOwner(db);
        const expense = await createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `summary-expense-${crypto.randomUUID()}`,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 50_000n,
          transactionDate: "2026-09-30",
          note: "",
        });
        if (!expense.ok) {
          throw new Error("Expected the expense to save");
        }
        expect(
          (
            await createTransaction(db, {
              ownerId: owner.ownerId,
              idempotencyKey: `summary-income-${crypto.randomUUID()}`,
              type: "income",
              walletId: owner.cashId,
              categoryId: owner.incomeId,
              amount: 100_000n,
              transactionDate: "2026-09-30",
              note: "",
            })
          ).ok,
        ).toBe(true);
        expect(
          (
            await createTransaction(db, {
              ownerId: owner.ownerId,
              idempotencyKey: `summary-refund-${crypto.randomUUID()}`,
              type: "refund",
              walletId: owner.bankId,
              categoryId: null,
              refundOfTransactionId: expense.value.transaction.id,
              amount: 10_000n,
              transactionDate: "2026-09-30",
              note: "",
            })
          ).ok,
        ).toBe(true);
        expect(
          (
            await createTransaction(db, {
              ownerId: owner.ownerId,
              idempotencyKey: `summary-transfer-${crypto.randomUUID()}`,
              type: "transfer",
              walletId: owner.cashId,
              destinationWalletId: owner.bankId,
              categoryId: null,
              amount: 200_000n,
              transactionDate: "2026-09-30",
              note: "",
            })
          ).ok,
        ).toBe(true);
        expect(
          await getMonthlySummary(db, {
            ownerId: owner.ownerId,
            month: "2026-09",
          }),
        ).toEqual({
          month: "2026-09",
          income: 100_000n,
          grossExpenses: 50_000n,
          refunds: 10_000n,
          netExpenses: 40_000n,
          net: 60_000n,
          transactionCount: 3,
        });

        expect(
          (
            await createTransaction(db, {
              ownerId: owner.ownerId,
              idempotencyKey: `summary-october-refund-${crypto.randomUUID()}`,
              type: "refund",
              walletId: owner.bankId,
              categoryId: null,
              refundOfTransactionId: expense.value.transaction.id,
              amount: 5_000n,
              transactionDate: "2026-10-01",
              note: "",
            })
          ).ok,
        ).toBe(true);
        expect(
          await getMonthlySummary(db, {
            ownerId: owner.ownerId,
            month: "2026-10",
          }),
        ).toEqual({
          month: "2026-10",
          income: 0n,
          grossExpenses: 0n,
          refunds: 5_000n,
          netExpenses: -5_000n,
          net: 5_000n,
          transactionCount: 1,
        });

        for (let index = 0; index < 3; index += 1) {
          expect(
            (
              await createTransaction(db, {
                ownerId: owner.ownerId,
                idempotencyKey: `summary-large-${crypto.randomUUID()}`,
                type: "income",
                walletId: owner.cashId,
                categoryId: owner.incomeId,
                amount: 9_999_999_999n,
                transactionDate: "2026-10-01",
                note: "",
              })
            ).ok,
          ).toBe(true);
        }
        expect(
          (
            await getMonthlySummary(db, {
              ownerId: owner.ownerId,
              month: "2026-10",
            })
          ).income,
        ).toBe(29_999_999_997n);

        const foreign = await setupOwner(db);
        expect(
          await getMonthlySummary(db, {
            ownerId: foreign.ownerId,
            month: "2026-09",
          }),
        ).toEqual({
          month: "2026-09",
          income: 0n,
          grossExpenses: 0n,
          refunds: 0n,
          netExpenses: 0n,
          net: 0n,
          transactionCount: 0,
        });
      });
    });
  });

  test("follows corrections and deletions in the month they apply to", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await recordExpense(db, owner);
      expect(
        (
          await getMonthlySummary(db, {
            ownerId: owner.ownerId,
            month: "2026-09",
          })
        ).netExpenses,
      ).toBe(50_000n);

      expect(
        (
          await updateTransaction(db, {
            ownerId: owner.ownerId,
            id: expense.id,
            walletId: owner.cashId,
            categoryId: owner.childId,
            amount: 60_000n,
            transactionDate: "2026-09-01",
            note: "Corrected",
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await getMonthlySummary(db, {
            ownerId: owner.ownerId,
            month: "2026-09",
          })
        ).netExpenses,
      ).toBe(60_000n);

      expect(
        (
          await deleteTransaction(db, {
            ownerId: owner.ownerId,
            id: expense.id,
          })
        ).ok,
      ).toBe(true);
      expect(
        await getMonthlySummary(db, {
          ownerId: owner.ownerId,
          month: "2026-09",
        }),
      ).toEqual({
        month: "2026-09",
        income: 0n,
        grossExpenses: 0n,
        refunds: 0n,
        netExpenses: 0n,
        net: 0n,
        transactionCount: 0,
      });
    });
  });
});

describe("monthly wallet balances", () => {
  test("monthly totals use financial dates, own-month refunds and exact satang independently of transfers", async () => {
    await withClock("2026-09-30T17:00:00Z", async () => {
      await withRollback(async (db) => {
        const owner = await setupOwner(db);
        const expense = await createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `wallet-summary-expense-${crypto.randomUUID()}`,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 50_000n,
          transactionDate: "2026-09-30",
          note: "",
        });
        if (!expense.ok) {
          throw new Error("Expected the expense to save");
        }
        const income = await createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `wallet-summary-income-${crypto.randomUUID()}`,
          type: "income",
          walletId: owner.cashId,
          categoryId: owner.incomeId,
          amount: 100_000n,
          transactionDate: "2026-09-30",
          note: "",
        });
        if (!income.ok) {
          throw new Error("Expected the income to save");
        }
        const refund = await createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `wallet-summary-refund-${crypto.randomUUID()}`,
          type: "refund",
          walletId: owner.cashId,
          categoryId: null,
          refundOfTransactionId: expense.value.transaction.id,
          amount: 10_000n,
          transactionDate: "2026-09-30",
          note: "",
        });
        if (!refund.ok) {
          throw new Error("Expected the refund to save");
        }
        const transfer = await createTransaction(db, {
          ownerId: owner.ownerId,
          idempotencyKey: `wallet-summary-transfer-${crypto.randomUUID()}`,
          type: "transfer",
          walletId: owner.cashId,
          destinationWalletId: owner.bankId,
          categoryId: null,
          amount: 200_000n,
          transactionDate: "2026-09-30",
          note: "",
        });
        if (!transfer.ok) {
          throw new Error("Expected the transfer to save");
        }
        expect(
          (
            await listWallets(db, {
              ownerId: owner.ownerId,
              asOf: "2026-09-30",
            })
          ).map((wallet) => wallet.balance),
        ).toEqual([860_000n, 200_000n]);
      });
    });
  });
});

describe("listTransactionChanges", () => {
  test("another user cannot edit, delete, or read the history of a transaction", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const transaction = await recordExpense(db, alice);

      expect(
        await listTransactionChanges(db, {
          ownerId: bob.ownerId,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });
});

describe("filtered financial history", () => {
  test("combines dates, wallet, type and category descendants; transfers match both wallets", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const expense = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `history-expense-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Child expense",
      });
      if (!expense.ok) {
        throw new Error("Expense rejected");
      }
      const direct = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `history-direct-${crypto.randomUUID()}`,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.parentId,
        amount: 100n,
        transactionDate: "2026-09-03",
        note: "Direct expense",
      });
      if (!direct.ok) {
        throw new Error("Expense rejected");
      }
      const refund = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `history-refund-${crypto.randomUUID()}`,
        type: "refund",
        walletId: owner.bankId,
        categoryId: null,
        refundOfTransactionId: expense.value.transaction.id,
        amount: 10_000n,
        transactionDate: "2026-09-04",
        note: "Refund",
      });
      if (!refund.ok) {
        throw new Error("Refund rejected");
      }
      const transfer = await createTransaction(db, {
        ownerId: owner.ownerId,
        idempotencyKey: `history-transfer-${crypto.randomUUID()}`,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        categoryId: null,
        amount: 1_000n,
        transactionDate: "2026-09-02",
        note: "Transfer",
      });
      if (!transfer.ok) {
        throw new Error("Transfer rejected");
      }
      const combined = await listTransactions(db, {
        ownerId: owner.ownerId,
        from: "2026-09-02",
        to: "2026-09-02",
        walletId: owner.cashId,
        categoryId: owner.parentId,
        type: "expense",
      });
      expect(combined.map((row) => row.id)).toEqual([
        expense.value.transaction.id,
      ]);
      expect(
        (
          await listTransactions(db, {
            ownerId: owner.ownerId,
            categoryId: owner.parentId,
          })
        ).map((row) => row.id),
      ).toEqual([
        refund.value.transaction.id,
        direct.value.transaction.id,
        expense.value.transaction.id,
      ]);
      expect(
        (
          await listTransactions(db, {
            ownerId: owner.ownerId,
            categoryId: owner.childId,
            type: "refund",
          })
        )[0]?.refundOf?.id,
      ).toBe(expense.value.transaction.id);
      for (const wallet of [owner.cashId, owner.bankId]) {
        expect(
          (
            await listTransactions(db, {
              ownerId: owner.ownerId,
              walletId: wallet,
              type: "transfer",
            })
          ).map((row) => row.id),
        ).toEqual([transfer.value.transaction.id]);
      }
      const foreign = await setupOwner(db);
      expect(
        await listTransactions(db, {
          ownerId: foreign.ownerId,
          walletId: owner.cashId,
        }),
      ).toEqual([]);
      expect(
        await listTransactions(db, {
          ownerId: foreign.ownerId,
          categoryId: owner.parentId,
        }),
      ).toEqual([]);
      expect(
        (
          await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-08-31" })
        ).map((wallet) => wallet.balance),
      ).toEqual([0n, 0n]);
    });
  });
});

test("corrections, archiving and category fallbacks replace effects across history and reports", async () => {
  await withRollback(async (db) => {
    const owner = await setupOwner(db);
    const expense = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `fallback-expense-${crypto.randomUUID()}`,
      type: "expense",
      walletId: owner.cashId,
      categoryId: owner.childId,
      amount: 50_000n,
      transactionDate: "2026-09-02",
      note: "",
    });
    if (!expense.ok) {
      throw new Error("Expense rejected");
    }
    const expenseId = expense.value.transaction.id;
    const childIconId = expense.value.transaction.category?.iconId;
    if (!childIconId) {
      throw new Error("Expected the expense to carry a category");
    }
    const refund = await createTransaction(db, {
      ownerId: owner.ownerId,
      idempotencyKey: `fallback-refund-${crypto.randomUUID()}`,
      type: "refund",
      walletId: owner.bankId,
      categoryId: null,
      refundOfTransactionId: expenseId,
      amount: 10_000n,
      transactionDate: "2026-09-03",
      note: "",
    });
    if (!refund.ok) {
      throw new Error("Refund rejected");
    }
    expect(
      (
        await updateTransaction(db, {
          ownerId: owner.ownerId,
          id: expenseId,
          walletId: owner.cashId,
          categoryId: owner.childId,
          amount: 60_000n,
          transactionDate: "2026-09-01",
          note: "Corrected",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await replaceWalletOpening(db, {
          ownerId: owner.ownerId,
          id: owner.cashId,
          openingAmount: 1_100_000n,
          openingDate: "2026-09-01",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await setWalletArchived(db, {
          ownerId: owner.ownerId,
          id: owner.cashId,
          archived: true,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await listWallets(db, { ownerId: owner.ownerId, asOf: "2026-09-01" })
      ).map((wallet) => wallet.balance),
    ).toEqual([1_040_000n, 0n]);
    expect(
      (
        await updateCategory(db, {
          ownerId: owner.ownerId,
          id: owner.childId,
          name: "Renamed child",
          iconId: childIconId,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await listTransactions(db, { ownerId: owner.ownerId, type: "refund" })
      )[0]?.category?.name,
    ).toBe("Renamed child");
    expect(
      (await removeCategory(db, { ownerId: owner.ownerId, id: owner.childId }))
        .ok,
    ).toBe(true);
    expect(
      await listTransactions(db, {
        ownerId: owner.ownerId,
        categoryId: owner.childId,
      }),
    ).toHaveLength(0);
    expect(
      await listTransactions(db, {
        ownerId: owner.ownerId,
        categoryId: owner.parentId,
      }),
    ).toHaveLength(2);
    const siblings = (await listCategories(db, owner.ownerId)).filter(
      (category) => category.parentId === owner.parentId,
    );
    for (const sibling of siblings) {
      expect(
        (await removeCategory(db, { ownerId: owner.ownerId, id: sibling.id }))
          .ok,
      ).toBe(true);
    }
    expect(
      (await removeCategory(db, { ownerId: owner.ownerId, id: owner.parentId }))
        .ok,
    ).toBe(true);
    const uncategorized = (await listCategories(db, owner.ownerId)).find(
      (category) => category.kind === "expense" && category.isProtected,
    );
    if (!uncategorized) {
      throw new Error("Missing Uncategorized");
    }
    expect(
      await listTransactions(db, {
        ownerId: owner.ownerId,
        categoryId: uncategorized.id,
      }),
    ).toHaveLength(2);
    expect(
      (
        await getMonthlySummary(db, {
          ownerId: owner.ownerId,
          month: "2026-09",
        })
      ).netExpenses,
    ).toBe(50_000n);
    expect(
      (
        await deleteTransaction(db, {
          ownerId: owner.ownerId,
          id: refund.value.transaction.id,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await deleteTransaction(db, { ownerId: owner.ownerId, id: expenseId }))
        .ok,
    ).toBe(true);
    expect(await listTransactions(db, { ownerId: owner.ownerId })).toEqual([]);
    expect(
      (
        await getMonthlySummary(db, {
          ownerId: owner.ownerId,
          month: "2026-09",
        })
      ).net,
    ).toBe(0n);
    expect(
      (await listWallets(db, { ownerId: owner.ownerId })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([1_100_000n, 0n]);
    const foreign = await setupOwner(db);
    expect(
      await findTransaction(db, {
        ownerId: foreign.ownerId,
        id: refund.value.transaction.id,
      }),
    ).toBeNull();
  });
});
