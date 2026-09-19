import { randomUUID } from "node:crypto";
import {
  initializeDefaultCategories,
  listCategories,
  removeCategory,
  updateCategory,
} from "@bookkeeping/application/categories";
import { createCategoryForTest as createCategory } from "@bookkeeping/application/testing/category-fixture";
import {
  listWallets,
  replaceWalletOpening,
  setWalletArchived,
} from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { describe, expect, test, vi } from "vitest";
import { getMonthlySummary } from "@/features/transactions/server/history";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { openWallet } from "@/testing/wallet-fixture";

const { withRollback } = setupTestDatabase();

async function fixture(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const tree = await listCategories(db, owner.id);
  const parent = tree.find(
    (category) =>
      category.kind === "expense" && category.name === "Food & Drink",
  );
  const income = tree.find(
    (category) => category.kind === "income" && category.isProtected,
  );
  if (!parent || !income) {
    throw new Error("Missing default categories");
  }
  const child = await createCategory(db, {
    ownerId: owner.id,
    kind: "expense",
    name: "History child",
    iconId: parent.iconId,
    parent: { existingId: parent.id },
  });
  if (!child.ok) {
    throw new Error("Cannot create child");
  }
  const cash = await openWallet(db, {
    ownerId: owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 1_200_000n,
    openingDate: "2026-09-01",
  });
  const bank = await openWallet(db, {
    ownerId: owner.id,
    name: "Bank",
    type: "bank_account",
    openingAmount: 0n,
    openingDate: "2026-09-01",
  });
  return {
    ownerId: owner.id,
    parent,
    child: child.value.category,
    income,
    cash,
    bank,
  };
}

describe("filtered financial history", () => {
  test("combines dates, wallet, type and category descendants; transfers match both wallets", async () => {
    await withRollback(async (db) => {
      const f = await fixture(db);
      const expense = await createTransaction(db, {
        ownerId: f.ownerId,
        submissionKey: randomUUID(),
        type: "expense",
        walletId: f.cash.id,
        categoryId: f.child.id,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Child expense",
      });
      if (!expense.ok) {
        throw new Error("Expense rejected");
      }
      const direct = await createTransaction(db, {
        ownerId: f.ownerId,
        submissionKey: randomUUID(),
        type: "expense",
        walletId: f.cash.id,
        categoryId: f.parent.id,
        amount: 100n,
        transactionDate: "2026-09-03",
        note: "Direct expense",
      });
      if (!direct.ok) {
        throw new Error("Expense rejected");
      }
      const refund = await createTransaction(db, {
        ownerId: f.ownerId,
        submissionKey: randomUUID(),
        type: "refund",
        walletId: f.bank.id,
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
        ownerId: f.ownerId,
        submissionKey: randomUUID(),
        type: "transfer",
        walletId: f.cash.id,
        destinationWalletId: f.bank.id,
        currency: "THB",
        categoryId: null,
        amount: 1_000n,
        transactionDate: "2026-09-02",
        note: "Transfer",
      });
      if (!transfer.ok) {
        throw new Error("Transfer rejected");
      }
      const combined = await listTransactions(db, {
        ownerId: f.ownerId,
        from: "2026-09-02",
        to: "2026-09-02",
        walletId: f.cash.id,
        categoryId: f.parent.id,
        type: "expense",
      });
      expect(combined.map((row) => row.id)).toEqual([
        expense.value.transaction.id,
      ]);
      expect(
        (
          await listTransactions(db, {
            ownerId: f.ownerId,
            categoryId: f.parent.id,
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
            ownerId: f.ownerId,
            categoryId: f.child.id,
            type: "refund",
          })
        )[0]?.refundOf?.id,
      ).toBe(expense.value.transaction.id);
      for (const wallet of [f.cash, f.bank]) {
        expect(
          (
            await listTransactions(db, {
              ownerId: f.ownerId,
              walletId: wallet.id,
              type: "transfer",
            })
          ).map((row) => row.id),
        ).toEqual([transfer.value.transaction.id]);
      }
      const foreign = await fixture(db);
      expect(
        await listTransactions(db, {
          ownerId: foreign.ownerId,
          walletId: f.cash.id,
        }),
      ).toEqual([]);
      expect(
        await listTransactions(db, {
          ownerId: foreign.ownerId,
          categoryId: f.parent.id,
        }),
      ).toEqual([]);
      expect(
        (await listWallets(db, { ownerId: f.ownerId, asOf: "2026-08-31" })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([0n, 0n]);
    });
  });
});

test("monthly totals use financial dates, own-month refunds and exact satang independently of transfers", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T17:00:00Z"));
  try {
    await withRollback(async (db) => {
      const f = await fixture(db);
      const base = {
        ownerId: f.ownerId,
        walletId: f.cash.id,
        note: "",
        transactionDate: "2026-09-30",
      };
      const expense = await createTransaction(db, {
        ...base,
        submissionKey: randomUUID(),
        type: "expense",
        categoryId: f.child.id,
        amount: 50_000n,
      });
      if (!expense.ok) {
        throw new Error("Expense rejected");
      }
      expect(
        (
          await createTransaction(db, {
            ...base,
            submissionKey: randomUUID(),
            type: "income",
            categoryId: f.income.id,
            amount: 100_000n,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await createTransaction(db, {
            ...base,
            submissionKey: randomUUID(),
            type: "refund",
            categoryId: null,
            refundOfTransactionId: expense.value.transaction.id,
            amount: 10_000n,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await createTransaction(db, {
            ...base,
            submissionKey: randomUUID(),
            type: "transfer",
            currency: "THB",
            categoryId: null,
            destinationWalletId: f.bank.id,
            amount: 200_000n,
          })
        ).ok,
      ).toBe(true);
      expect(
        await getMonthlySummary(db, { ownerId: f.ownerId, month: "2026-09" }),
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
            ...base,
            submissionKey: randomUUID(),
            type: "refund",
            categoryId: null,
            refundOfTransactionId: expense.value.transaction.id,
            amount: 5_000n,
            transactionDate: "2026-10-01",
          })
        ).ok,
      ).toBe(true);
      expect(
        await getMonthlySummary(db, { ownerId: f.ownerId, month: "2026-10" }),
      ).toMatchObject({
        income: 0n,
        grossExpenses: 0n,
        refunds: 5_000n,
        netExpenses: -5_000n,
        net: 5_000n,
      });
      for (let index = 0; index < 3; index += 1) {
        expect(
          (
            await createTransaction(db, {
              ...base,
              submissionKey: randomUUID(),
              type: "income",
              categoryId: f.income.id,
              amount: 9_999_999_999n,
              transactionDate: "2026-10-01",
            })
          ).ok,
        ).toBe(true);
      }
      expect(
        (await getMonthlySummary(db, { ownerId: f.ownerId, month: "2026-10" }))
          .income,
      ).toBe(29_999_999_997n);
      const foreign = await fixture(db);
      expect(
        (
          await getMonthlySummary(db, {
            ownerId: foreign.ownerId,
            month: "2026-09",
          })
        ).net,
      ).toBe(0n);
      expect(
        (await listWallets(db, { ownerId: f.ownerId, asOf: "2026-09-30" })).map(
          (wallet) => wallet.balance,
        ),
      ).toEqual([1_060_000n, 200_000n]);
    });
  } finally {
    vi.useRealTimers();
  }
});

test("corrections, archiving and category fallbacks replace effects across history and reports", async () => {
  await withRollback(async (db) => {
    const f = await fixture(db);
    const expense = await createTransaction(db, {
      ownerId: f.ownerId,
      submissionKey: randomUUID(),
      type: "expense",
      walletId: f.cash.id,
      categoryId: f.child.id,
      amount: 50_000n,
      transactionDate: "2026-09-02",
      note: "",
    });
    if (!expense.ok) {
      throw new Error("Expense rejected");
    }
    const expenseId = expense.value.transaction.id;
    const refund = await createTransaction(db, {
      ownerId: f.ownerId,
      submissionKey: randomUUID(),
      type: "refund",
      walletId: f.bank.id,
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
          ownerId: f.ownerId,
          id: expenseId,
          walletId: f.cash.id,
          categoryId: f.child.id,
          amount: 60_000n,
          transactionDate: "2026-09-01",
          note: "Corrected",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await replaceWalletOpening(db, {
          ownerId: f.ownerId,
          id: f.cash.id,
          openingAmount: 1_000_000n,
          openingDate: "2026-09-01",
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await setWalletArchived(db, {
          ownerId: f.ownerId,
          id: f.cash.id,
          archived: true,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await listWallets(db, { ownerId: f.ownerId, asOf: "2026-09-01" })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([940_000n, 0n]);
    expect(
      (
        await updateCategory(db, {
          ownerId: f.ownerId,
          id: f.child.id,
          name: "Renamed child",
          iconId: f.child.iconId,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await listTransactions(db, { ownerId: f.ownerId, type: "refund" }))[0]
        ?.category?.name,
    ).toBe("Renamed child");
    expect(
      (await removeCategory(db, { ownerId: f.ownerId, id: f.child.id })).ok,
    ).toBe(true);
    expect(
      await listTransactions(db, {
        ownerId: f.ownerId,
        categoryId: f.child.id,
      }),
    ).toHaveLength(0);
    expect(
      await listTransactions(db, {
        ownerId: f.ownerId,
        categoryId: f.parent.id,
      }),
    ).toHaveLength(2);
    const siblings = (await listCategories(db, f.ownerId)).filter(
      (category) => category.parentId === f.parent.id,
    );
    for (const sibling of siblings) {
      expect(
        (await removeCategory(db, { ownerId: f.ownerId, id: sibling.id })).ok,
      ).toBe(true);
    }
    expect(
      (await removeCategory(db, { ownerId: f.ownerId, id: f.parent.id })).ok,
    ).toBe(true);
    const uncategorized = (await listCategories(db, f.ownerId)).find(
      (category) => category.kind === "expense" && category.isProtected,
    );
    if (!uncategorized) {
      throw new Error("Missing Uncategorized");
    }
    expect(
      await listTransactions(db, {
        ownerId: f.ownerId,
        categoryId: uncategorized.id,
      }),
    ).toHaveLength(2);
    expect(
      (await getMonthlySummary(db, { ownerId: f.ownerId, month: "2026-09" }))
        .netExpenses,
    ).toBe(50_000n);
    expect(
      (
        await deleteTransaction(db, {
          ownerId: f.ownerId,
          id: refund.value.transaction.id,
        })
      ).ok,
    ).toBe(true);
    expect(
      (await deleteTransaction(db, { ownerId: f.ownerId, id: expenseId })).ok,
    ).toBe(true);
    expect(await listTransactions(db, { ownerId: f.ownerId })).toEqual([]);
    expect(
      (await getMonthlySummary(db, { ownerId: f.ownerId, month: "2026-09" }))
        .net,
    ).toBe(0n);
    expect(
      (await listWallets(db, { ownerId: f.ownerId })).map(
        (wallet) => wallet.balance,
      ),
    ).toEqual([1_000_000n, 0n]);
    const foreign = await fixture(db);
    expect(
      await getTransaction(db, {
        ownerId: foreign.ownerId,
        id: refund.value.transaction.id,
      }),
    ).toBeUndefined();
  });
});

test("overall balances retain satang beyond JavaScript integer precision and allow negative holdings", async () => {
  await withRollback(async (db) => {
    const owner = await createTestUser(db);
    await openWallet(db, {
      ownerId: owner.id,
      name: "Large",
      type: "bank_account",
      openingAmount: 90_071_992_547_409_919n,
      openingDate: "2026-09-01",
    });
    await openWallet(db, {
      ownerId: owner.id,
      name: "Negative",
      type: "cash",
      openingAmount: -123n,
      openingDate: "2026-09-02",
    });
    const dated = await listWallets(db, {
      ownerId: owner.id,
      asOf: "2026-09-01",
    });
    expect(dated.map((wallet) => wallet.balance)).toEqual([
      90_071_992_547_409_919n,
      0n,
    ]);
    const current = await listWallets(db, { ownerId: owner.id });
    expect(current.reduce((total, wallet) => total + wallet.balance, 0n)).toBe(
      90_071_992_547_409_796n,
    );
  });
});
