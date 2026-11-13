import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { listCategories } from "../categories/category-reads";
import { insertTransaction } from "../testing/transaction-fixture";
import {
  recordExpense,
  setupOwner,
  withClock,
} from "../testing/transaction-suite-fixture";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./transaction";
import {
  getCategorySpending,
  getDailySummary,
  getMonthlySummary,
} from "./transaction-reports";

const { withRollback } = setupTestDatabase();

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
              refundOfTransactionId: expense.value.id,
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
              refundOfTransactionId: expense.value.id,
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
            tagIds: [],
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

describe("getDailySummary", () => {
  test("totals one date, netting a refund of an earlier expense and leaving neighbours and transfers out", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const earlier = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 30_000n,
        transactionDate: "2026-09-09",
      });
      for (const [type, amount, transactionDate] of [
        ["income", 100_000n, "2026-09-10"],
        ["expense", 50_000n, "2026-09-10"],
        ["income", 999_000n, "2026-09-11"],
      ] as const) {
        await insertTransaction(db, {
          ownerId: owner.ownerId,
          type,
          walletId: owner.cashId,
          categoryId: type === "income" ? owner.incomeId : owner.childId,
          amount,
          transactionDate,
        });
      }
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: earlier,
        amount: 10_000n,
        transactionDate: "2026-09-10",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-10",
      });

      expect(
        await getDailySummary(db, {
          ownerId: owner.ownerId,
          date: "2026-09-10",
        }),
      ).toEqual({
        date: "2026-09-10",
        income: 100_000n,
        grossExpenses: 50_000n,
        refunds: 10_000n,
        netExpenses: 40_000n,
        net: 60_000n,
        transactionCount: 3,
      });
    });
  });
});

async function expenseCategoryId(
  db: Database,
  { ownerId, name }: { ownerId: string; name: string },
): Promise<string> {
  const category = (await listCategories(db, ownerId)).find(
    (candidate) => candidate.kind === "expense" && candidate.name === name,
  );
  if (!category) {
    throw new Error(`Missing expense category ${name}`);
  }
  return category.id;
}

describe("getCategorySpending share base", () => {
  test("equals Net expenses when every parent has positive spending", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const fuel = await expenseCategoryId(db, {
        ownerId: owner.ownerId,
        name: "Fuel",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 30_000n,
        transactionDate: "2026-09-10",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: fuel,
        amount: 20_000n,
        transactionDate: "2026-09-11",
      });

      const spending = await getCategorySpending(db, {
        ownerId: owner.ownerId,
        month: "2026-09",
      });

      expect(spending.netExpenses).toBe(50_000n);
      expect(spending.shareBase).toBe(50_000n);
    });
  });

  test("leaves out a parent whose refunds outran its spending, so it exceeds Net expenses", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const fuel = await expenseCategoryId(db, {
        ownerId: owner.ownerId,
        name: "Fuel",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 30_000n,
        transactionDate: "2026-09-10",
      });
      const earlierFuel = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: fuel,
        amount: 20_000n,
        transactionDate: "2026-08-31",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: earlierFuel,
        amount: 20_000n,
        transactionDate: "2026-09-05",
      });

      const spending = await getCategorySpending(db, {
        ownerId: owner.ownerId,
        month: "2026-09",
      });

      expect(spending.netExpenses).toBe(10_000n);
      expect(spending.shareBase).toBe(30_000n);
    });
  });

  test("is zero for a month where no parent has positive spending", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const earlier = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 30_000n,
        transactionDate: "2026-08-31",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: earlier,
        amount: 30_000n,
        transactionDate: "2026-09-05",
      });

      const spending = await getCategorySpending(db, {
        ownerId: owner.ownerId,
        month: "2026-09",
      });

      expect(spending.netExpenses).toBe(-30_000n);
      expect(spending.shareBase).toBe(0n);
    });
  });

  test("is zero for a month with no activity", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);

      const spending = await getCategorySpending(db, {
        ownerId: owner.ownerId,
        month: "2026-09",
      });

      expect(spending.parents).toEqual([]);
      expect(spending.shareBase).toBe(0n);
    });
  });
});
