import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { wallets } from "@bookkeeping/database/wallets";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import { listCategories } from "@/features/categories/server/category";
import type { CreateTransactionInput } from "@/features/transactions/server/transaction";
import {
  createTransaction,
  deleteTransaction,
  getExpenseRefunds,
  getTransaction,
  listTransactionChanges,
  listTransactions,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { createWallet, listWallets } from "@/features/wallets/server/wallet";
import { setWalletArchived } from "@/features/wallets/server/wallet-lifecycle";

const { withRollback, committed } = setupTestDatabase();

/** A user with the default trees and one wallet opened with ฿12,000 on 1 Sep. */
async function setupOwner(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const wallet = await createWallet(db, {
    ownerId: owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 1_200_000n,
    openingDate: "2026-09-01",
  });
  const categories = await listCategories(db, owner.id);
  function category(kind: "income" | "expense", name: string) {
    const found = categories.find((c) => c.kind === kind && c.name === name);
    if (!found) {
      throw new Error(`Missing ${kind} category ${name}`);
    }
    return found;
  }
  return {
    owner,
    wallet,
    expenseUncategorized: category("expense", "Uncategorized"),
    incomeUncategorized: category("income", "Uncategorized"),
    groceries: category("expense", "Groceries"),
    salary: category("income", "Salary"),
  };
}

function withClock<T>(iso: string, run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  return run().finally(() => vi.useRealTimers());
}

let keySequence = 0;
function freshKey() {
  keySequence += 1;
  return `key-${process.pid}-${Date.now()}-${keySequence}`;
}

describe("recording income and expenses", () => {
  test("an expense subtracts and income adds to the wallet's derived balance", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, groceries, salary } = await setupOwner(db);

      const expense = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: wallet.id,
        categoryId: groceries.id,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });
      const income = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "income",
        walletId: wallet.id,
        categoryId: salary.id,
        amount: 100_000n,
        transactionDate: "2026-09-03",
        note: "",
      });

      expect(expense.ok && expense.value.replayed).toBe(false);
      expect(income.ok).toBe(true);
      const [summary] = await listWallets(db, { ownerId: owner.id });
      expect(summary?.balance).toBe(1_250_000n);

      const listed = await listTransactions(db, { ownerId: owner.id });
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
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
        amount: 1_500_000n,
        transactionDate: "2026-09-05",
        note: "",
      });

      const [onOpeningDay] = await listWallets(db, {
        ownerId: owner.id,
        asOf: "2026-09-04",
      });
      const [afterExpense] = await listWallets(db, {
        ownerId: owner.id,
        asOf: "2026-09-05",
      });
      expect(onOpeningDay?.balance).toBe(1_200_000n);
      expect(afterExpense?.balance).toBe(-300_000n);
    });
  });

  test("exact bounds are accepted and out-of-range amounts are rejected without rounding", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      function attempt(amount: bigint) {
        return createTransaction(db, {
          ownerId: owner.id,
          submissionKey: freshKey(),
          type: "expense",
          walletId: wallet.id,
          categoryId: expenseUncategorized.id,
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
          error: { code: "amount-out-of-range" },
        });
      }
      const [summary] = await listWallets(db, { ownerId: owner.id });
      expect(summary?.balance).toBe(1_200_000n - 1n - 9_999_999_999n);
    });
  });

  test("a note over 200 characters is rejected", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      const rejected = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "x".repeat(201),
      });
      expect(rejected).toEqual({ ok: false, error: { code: "note-too-long" } });
      expect(await listTransactions(db, { ownerId: owner.id })).toEqual([]);
    });
  });

  test("Bangkok midnight decides which dates are in the future", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      function attemptOn(date: string) {
        return createTransaction(db, {
          ownerId: owner.id,
          submissionKey: freshKey(),
          type: "expense",
          walletId: wallet.id,
          categoryId: expenseUncategorized.id,
          amount: 100n,
          transactionDate: date,
          note: "",
        });
      }
      // 17:30 UTC on 13 Sep is already 00:30 on 14 Sep in Bangkok.
      await withClock("2026-09-13T17:30:00Z", async () => {
        expect(await attemptOn("2026-09-15")).toEqual({
          ok: false,
          error: { code: "future-date", today: "2026-09-14" },
        });
        expect((await attemptOn("2026-09-14")).ok).toBe(true);
      });
      // 16:30 UTC is still 23:30 on 13 Sep in Bangkok.
      await withClock("2026-09-13T16:30:00Z", async () => {
        expect(await attemptOn("2026-09-14")).toEqual({
          ok: false,
          error: { code: "future-date", today: "2026-09-13" },
        });
      });
    });
  });

  test("the opening day is allowed and the day before it is rejected by name", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, incomeUncategorized } = await setupOwner(db);
      function attemptOn(date: string) {
        return createTransaction(db, {
          ownerId: owner.id,
          submissionKey: freshKey(),
          type: "income",
          walletId: wallet.id,
          categoryId: incomeUncategorized.id,
          amount: 100n,
          transactionDate: date,
          note: "",
        });
      }
      expect((await attemptOn("2026-09-01")).ok).toBe(true);
      expect(await attemptOn("2026-08-31")).toEqual({
        ok: false,
        error: { code: "before-opening", openingDate: "2026-09-01" },
      });
    });
  });

  test("a category from the other tree is rejected", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, salary } = await setupOwner(db);
      const rejected = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: wallet.id,
        categoryId: salary.id,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      });
      expect(rejected).toEqual({
        ok: false,
        error: { code: "category-kind-mismatch" },
      });
    });
  });

  test("another user's wallet, category, and transactions are not found", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const saved = await createTransaction(db, {
        ownerId: alice.owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: alice.wallet.id,
        categoryId: alice.groceries.id,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      });
      if (!saved.ok) {
        throw new Error("Expected Alice's expense to save");
      }

      expect(
        await createTransaction(db, {
          ownerId: bob.owner.id,
          submissionKey: freshKey(),
          type: "expense",
          walletId: alice.wallet.id,
          categoryId: bob.groceries.id,
          amount: 100n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      expect(
        await createTransaction(db, {
          ownerId: bob.owner.id,
          submissionKey: freshKey(),
          type: "expense",
          walletId: bob.wallet.id,
          categoryId: alice.groceries.id,
          amount: 100n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await getTransaction(db, {
          ownerId: bob.owner.id,
          id: saved.value.transaction.id,
        }),
      ).toBeUndefined();
      expect(await listTransactions(db, { ownerId: bob.owner.id })).toEqual([]);
      const [aliceWallet] = await listWallets(db, { ownerId: alice.owner.id });
      expect(aliceWallet?.balance).toBe(1_199_900n);
    });
  });

  test("the recording time is the server instant, separate from the transaction date", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      const before = new Date();
      const saved = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense",
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
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
});

describe("submission receipts", () => {
  test("the same key and payload saves once; distinct keys allow identical records", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      const input = {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense" as const,
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
        amount: 12_000n,
        transactionDate: "2026-09-02",
        note: "Lunch",
      };

      const first = await createTransaction(db, input);
      const retry = await createTransaction(db, input);
      const intentional = await createTransaction(db, {
        ...input,
        submissionKey: freshKey(),
      });

      if (!first.ok || !retry.ok || !intentional.ok) {
        throw new Error("Expected all three submissions to succeed");
      }
      expect(retry.value.replayed).toBe(true);
      expect(retry.value.transaction.id).toBe(first.value.transaction.id);
      expect(intentional.value.transaction.id).not.toBe(
        first.value.transaction.id,
      );
      expect(await listTransactions(db, { ownerId: owner.id })).toHaveLength(2);
      const [summary] = await listWallets(db, { ownerId: owner.id });
      expect(summary?.balance).toBe(1_176_000n);
    });
  });

  test("the same key with a changed payload conflicts and changes nothing", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      const input = {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense" as const,
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
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
        error: { code: "submission-conflict" },
      });
      const listed = await listTransactions(db, { ownerId: owner.id });
      expect(listed.map((t) => t.amount)).toEqual([12_000n]);
    });
  });

  test("a rejected submission leaves no receipt, so a corrected retry under the same key saves", async () => {
    await withRollback(async (db) => {
      const { owner, wallet, expenseUncategorized } = await setupOwner(db);
      const input = {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "expense" as const,
        walletId: wallet.id,
        categoryId: expenseUncategorized.id,
        amount: 100n,
        transactionDate: "2026-08-31",
        note: "",
      };
      expect((await createTransaction(db, input)).ok).toBe(false);

      const corrected = await createTransaction(db, {
        ...input,
        transactionDate: "2026-09-01",
      });
      expect(corrected.ok && corrected.value.replayed).toBe(false);
    });
  });

  test("simultaneous submissions with the same key commit exactly one transaction", async () => {
    const db = committed();
    const { owner, wallet, expenseUncategorized } = await setupOwner(db);
    const input = {
      ownerId: owner.id,
      submissionKey: freshKey(),
      type: "expense" as const,
      walletId: wallet.id,
      categoryId: expenseUncategorized.id,
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
    expect(await listTransactions(db, { ownerId: owner.id })).toHaveLength(1);
    const [summary] = await listWallets(db, { ownerId: owner.id });
    expect(summary?.balance).toBe(1_150_000n);
  });
});

interface RecordExpenseOptions {
  db: Database;
  owner: Awaited<ReturnType<typeof setupOwner>>;
  overrides?: Partial<CreateTransactionInput>;
}

/** A committed ฿500 expense on 2 Sep; the wallet then holds ฿11,500. */
async function recordExpense({
  db,
  owner,
  overrides = {},
}: Readonly<RecordExpenseOptions>) {
  const input: CreateTransactionInput = {
    ownerId: owner.owner.id,
    submissionKey: freshKey(),
    type: "expense",
    walletId: owner.wallet.id,
    categoryId: owner.groceries.id,
    amount: 50_000n,
    transactionDate: "2026-09-02",
    note: "Weekly shop",
    ...overrides,
  };
  const saved = await createTransaction(db, input);
  if (!saved.ok) {
    throw new Error(`Expected the expense to save, got ${saved.error.code}`);
  }
  return { input, transaction: saved.value.transaction };
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
  const found = summaries.find((w) => w.id === walletId);
  if (!found) {
    throw new Error("Wallet not listed");
  }
  return found.balance;
}

describe("correcting transactions", () => {
  test("an edit replaces every financial effect, keeps the recording time, and leaves one history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const savings = await createWallet(db, {
        ownerId: owner.owner.id,
        name: "Savings",
        type: "bank_account",
        openingAmount: 0n,
        openingDate: "2026-09-03",
      });
      const { transaction } = await recordExpense({ db, owner });
      const cashBefore = await balanceOf({
        db,
        ownerId: owner.owner.id,
        walletId: owner.wallet.id,
      });
      expect(cashBefore).toBe(1_150_000n);

      const updated = await updateTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
        walletId: savings.id,
        categoryId: owner.expenseUncategorized.id,
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
          wallet: expect.objectContaining({ id: savings.id }),
          category: expect.objectContaining({ name: "Uncategorized" }),
        }),
      );
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: owner.wallet.id,
        }),
      ).toBe(1_200_000n);
      expect(
        await balanceOf({ db, ownerId: owner.owner.id, walletId: savings.id }),
      ).toBe(-75_050n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: savings.id,
          asOf: "2026-09-03",
        }),
      ).toBe(0n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "edit",
          before: {
            type: "expense",
            walletId: owner.wallet.id,
            categoryId: owner.groceries.id,
            amount: "50000",
            transactionDate: "2026-09-02",
            note: "Weekly shop",
          },
          after: {
            type: "expense",
            walletId: savings.id,
            categoryId: owner.expenseUncategorized.id,
            amount: "75050",
            transactionDate: "2026-09-04",
            note: "Corrected",
          },
        }),
      ]);
      // No visible reversal entry: the list still holds exactly one row.
      expect(
        await listTransactions(db, { ownerId: owner.owner.id }),
      ).toHaveLength(1);
    });
  });

  test("saving an edit that changes nothing succeeds without a history entry", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const { input, transaction } = await recordExpense({ db, owner });
      const unchanged = await updateTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
        walletId: input.walletId,
        categoryId: input.categoryId,
        amount: input.amount,
        transactionDate: input.transactionDate,
        note: input.note,
      });
      expect(unchanged.ok).toBe(true);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  test("rejected edits change nothing and record no history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const late = await createWallet(db, {
        ownerId: owner.owner.id,
        name: "Late",
        type: "e_wallet",
        openingAmount: 0n,
        openingDate: "2026-09-05",
      });
      const { transaction } = await recordExpense({ db, owner });
      const valid = {
        ownerId: owner.owner.id,
        id: transaction.id,
        walletId: owner.wallet.id,
        categoryId: owner.groceries.id,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      };

      const attempts = [
        [{ ...valid, amount: 0n }, { code: "amount-out-of-range" }],
        [
          { ...valid, amount: 10_000_000_000n },
          { code: "amount-out-of-range" },
        ],
        [{ ...valid, note: "x".repeat(201) }, { code: "note-too-long" }],
        [
          { ...valid, transactionDate: "2026-08-31" },
          { code: "before-opening", openingDate: "2026-09-01" },
        ],
        // Moving to a wallet that opened after the transaction's date.
        [
          { ...valid, walletId: late.id },
          { code: "before-opening", openingDate: "2026-09-05" },
        ],
        [
          { ...valid, categoryId: owner.salary.id },
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

      const current = await getTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
      });
      expect(current).toEqual(transaction);
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: owner.wallet.id,
        }),
      ).toBe(1_150_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toEqual([]);
    });
  });

  test("another user cannot edit, delete, or read the history of a transaction", async () => {
    await withRollback(async (db) => {
      const alice = await setupOwner(db);
      const bob = await setupOwner(db);
      const { transaction } = await recordExpense({ db, owner: alice });

      expect(
        await updateTransaction(db, {
          ownerId: bob.owner.id,
          id: transaction.id,
          walletId: bob.wallet.id,
          categoryId: bob.groceries.id,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      // Bob's own wallet and category cannot be attached to Alice's record,
      // nor can Alice's record be moved onto Bob's wallet.
      expect(
        await updateTransaction(db, {
          ownerId: alice.owner.id,
          id: transaction.id,
          walletId: bob.wallet.id,
          categoryId: alice.groceries.id,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      expect(
        await updateTransaction(db, {
          ownerId: alice.owner.id,
          id: transaction.id,
          walletId: alice.wallet.id,
          categoryId: bob.groceries.id,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await deleteTransaction(db, {
          ownerId: bob.owner.id,
          id: transaction.id,
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await listTransactionChanges(db, {
          ownerId: bob.owner.id,
          id: transaction.id,
        }),
      ).toEqual([]);

      expect(
        await getTransaction(db, {
          ownerId: alice.owner.id,
          id: transaction.id,
        }),
      ).toEqual(transaction);
      expect(
        await balanceOf({
          db,
          ownerId: alice.owner.id,
          walletId: alice.wallet.id,
        }),
      ).toBe(1_150_000n);
    });
  });

  test("deletion removes the transaction from lists, detail, and every balance, and records history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const { transaction } = await recordExpense({ db, owner });
      const { transaction: kept } = await recordExpense({
        db,
        owner,
        overrides: {
          amount: 100n,
          transactionDate: "2026-09-03",
        },
      });

      const deleted = await deleteTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
      });

      expect(deleted).toEqual({ ok: true, value: { id: transaction.id } });
      expect(
        await getTransaction(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toBeUndefined();
      expect(
        (await listTransactions(db, { ownerId: owner.owner.id })).map(
          (t) => t.id,
        ),
      ).toEqual([kept.id]);
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: owner.wallet.id,
        }),
      ).toBe(1_199_900n);
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: owner.wallet.id,
          asOf: "2026-09-02",
        }),
      ).toBe(1_200_000n);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({ amount: "50000" }),
          after: null,
        }),
      ]);

      // Deleting again is the same outcome, not a second history entry;
      // editing a deleted transaction is not possible.
      expect(
        await deleteTransaction(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toEqual({ ok: true, value: { id: transaction.id } });
      expect(
        await updateTransaction(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
          walletId: owner.wallet.id,
          categoryId: owner.groceries.id,
          amount: 1n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
        }),
      ).toHaveLength(1);
    });
  });

  test("a late create retry after an edit or deletion confirms the current outcome", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const { input, transaction } = await recordExpense({ db, owner });
      await updateTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
        walletId: owner.wallet.id,
        categoryId: owner.groceries.id,
        amount: 60_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      });

      const afterEdit = await createTransaction(db, input);
      expect(afterEdit.ok && afterEdit.value.replayed).toBe(true);
      expect(afterEdit.ok && afterEdit.value.transaction.amount).toBe(60_000n);
      expect(
        await listTransactions(db, { ownerId: owner.owner.id }),
      ).toHaveLength(1);

      await deleteTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
      });
      const afterDelete = await createTransaction(db, input);
      expect(afterDelete.ok && afterDelete.value.replayed).toBe(true);
      expect(afterDelete.ok && afterDelete.value.transaction.id).toBe(
        transaction.id,
      );
      expect(await listTransactions(db, { ownerId: owner.owner.id })).toEqual(
        [],
      );
      expect(
        await balanceOf({
          db,
          ownerId: owner.owner.id,
          walletId: owner.wallet.id,
        }),
      ).toBe(1_200_000n);
    });
  });

  test("simultaneous edits serialize: every one lands in history and the balance matches the last", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const { transaction } = await recordExpense({ db, owner });
    const amounts = [1_000n, 2_000n, 3_000n, 4_000n, 5_000n];

    const outcomes = await Promise.all(
      amounts.map((amount) =>
        updateTransaction(db, {
          ownerId: owner.owner.id,
          id: transaction.id,
          walletId: owner.wallet.id,
          categoryId: owner.groceries.id,
          amount,
          transactionDate: "2026-09-02",
          note: "Weekly shop",
        }),
      ),
    );

    expect(outcomes.every((o) => o.ok)).toBe(true);
    const history = await listTransactionChanges(db, {
      ownerId: owner.owner.id,
      id: transaction.id,
    });
    expect(history).toHaveLength(5);
    // Each entry starts where the previous one ended.
    for (let i = 1; i < history.length; i += 1) {
      expect(history[i]?.before).toEqual(history[i - 1]?.after);
    }
    const final = await getTransaction(db, {
      ownerId: owner.owner.id,
      id: transaction.id,
    });
    expect(final?.amount).toBe(BigInt(history[4]?.after?.amount ?? "0"));
    expect(
      await balanceOf({
        db,
        ownerId: owner.owner.id,
        walletId: owner.wallet.id,
      }),
    ).toBe(1_200_000n - (final?.amount ?? 0n));
  });
});

describe("wallet transfers", () => {
  test("one transfer subtracts from its source and adds to its destination on its date", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await setupOwner(db);
      const destination = await createWallet(db, {
        ownerId: owner.id,
        name: "Bank",
        type: "bank_account",
        openingAmount: 0n,
        openingDate: "2026-09-02",
      });
      const result = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "transfer",
        currency: "THB",
        walletId: wallet.id,
        destinationWalletId: destination.id,
        categoryId: null,
        amount: 1_500_001n,
        transactionDate: "2026-09-02",
        note: "Move savings",
      });
      expect(result.ok).toBe(true);
      expect(
        await listWallets(db, { ownerId: owner.id, asOf: "2026-09-01" }),
      ).toEqual([
        expect.objectContaining({ balance: 1_200_000n }),
        expect.objectContaining({ balance: 0n }),
      ]);
      expect(
        await listWallets(db, { ownerId: owner.id, asOf: "2026-09-02" }),
      ).toEqual([
        expect.objectContaining({ balance: -300_001n }),
        expect.objectContaining({ balance: 1_500_001n }),
      ]);
      expect(await listTransactions(db, { ownerId: owner.id })).toEqual([
        expect.objectContaining({
          type: "transfer",
          category: null,
          wallet: expect.objectContaining({ id: wallet.id }),
          destinationWallet: expect.objectContaining({ id: destination.id }),
        }),
      ]);
    });
  });
});

test("editing a transfer replaces both wallets and deletion removes both effects and retains history", async () => {
  await withRollback(async (db) => {
    const { owner, wallet } = await setupOwner(db);
    const bank = await createWallet(db, {
      ownerId: owner.id,
      name: "Bank",
      type: "bank_account",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    const cash = await createWallet(db, {
      ownerId: owner.id,
      name: "Travel",
      type: "cash",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    const input = {
      ownerId: owner.id,
      submissionKey: freshKey(),
      type: "transfer",
      currency: "THB",
      walletId: wallet.id,
      destinationWalletId: bank.id,
      categoryId: null,
      amount: 100_000n,
      transactionDate: "2026-09-02",
      note: "",
    } satisfies CreateTransactionInput;
    const created = await createTransaction(db, input);
    if (!created.ok) {
      throw new Error("Transfer failed");
    }
    const { id, recordedAt } = created.value.transaction;
    const edited = await updateTransaction(db, {
      ...input,
      id,
      walletId: bank.id,
      destinationWalletId: cash.id,
      amount: 200_001n,
      transactionDate: "2026-09-03",
    });
    expect(edited.ok && edited.value.recordedAt).toEqual(recordedAt);
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_200_000n, -200_001n, 200_001n]);
    expect(
      (await listWallets(db, { ownerId: owner.id, asOf: "2026-09-02" })).map(
        (w) => w.balance,
      ),
    ).toEqual([1_200_000n, 0n, 0n]);
    expect(await deleteTransaction(db, { ownerId: owner.id, id })).toEqual({
      ok: true,
      value: { id },
    });
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_200_000n, 0n, 0n]);
    const history = await listTransactionChanges(db, { ownerId: owner.id, id });
    expect(history).toEqual([
      expect.objectContaining({
        action: "edit",
        before: expect.objectContaining({
          walletId: wallet.id,
          destinationWalletId: bank.id,
        }),
        after: expect.objectContaining({
          walletId: bank.id,
          destinationWalletId: cash.id,
          amount: "200001",
        }),
      }),
      expect.objectContaining({ action: "delete", after: null }),
    ]);
    const replay = await createTransaction(db, input);
    expect(replay.ok && replay.value.replayed).toBe(true);
    expect(await listTransactions(db, { ownerId: owner.id })).toEqual([]);
  });
});

test("transfer validation rejects same wallets, foreign wallets, missing currency, and dates outside either wallet's history", async () => {
  await withRollback(async (db) => {
    const { owner, wallet } = await setupOwner(db);
    const bank = await createWallet(db, {
      ownerId: owner.id,
      name: "Bank",
      type: "bank_account",
      openingAmount: 0n,
      openingDate: "2026-09-05",
    });
    const foreign = await setupOwner(db);
    const input = {
      ownerId: owner.id,
      submissionKey: freshKey(),
      type: "transfer",
      currency: "THB",
      walletId: wallet.id,
      destinationWalletId: bank.id,
      categoryId: null,
      amount: 100n,
      transactionDate: "2026-09-05",
      note: "",
    } satisfies CreateTransactionInput;
    for (const [changes, code] of [
      [{ destinationWalletId: wallet.id }, "same-wallet"],
      [
        { destinationWalletId: foreign.wallet.id },
        "destination-wallet-not-found",
      ],
      [{ walletId: foreign.wallet.id }, "wallet-not-found"],
      [{ currency: undefined }, "invalid-currency"],
      [{ transactionDate: "2026-09-04" }, "before-opening"],
      [
        {
          walletId: bank.id,
          destinationWalletId: wallet.id,
          transactionDate: "2026-09-04",
        },
        "before-opening",
      ],
      [{ transactionDate: "9999-01-01" }, "future-date"],
      [{ amount: 0n }, "amount-out-of-range"],
      [{ amount: 10_000_000_000n }, "amount-out-of-range"],
      [{ categoryId: foreign.groceries.id }, "invalid-transfer"],
    ] as const) {
      expect(await createTransaction(db, { ...input, ...changes })).toEqual({
        ok: false,
        error: expect.objectContaining({ code }),
      });
    }
    expect(await listTransactions(db, { ownerId: owner.id })).toEqual([]);
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_200_000n, 0n]);
  });
});

test("archived transfer wallets reject creation but existing edits can retain or swap their own archived references", async () => {
  await withRollback(async (db) => {
    const { owner, wallet } = await setupOwner(db);
    const bank = await createWallet(db, {
      ownerId: owner.id,
      name: "Bank",
      type: "bank_account",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    const other = await createWallet(db, {
      ownerId: owner.id,
      name: "Old wallet",
      type: "cash",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    const input = {
      ownerId: owner.id,
      submissionKey: freshKey(),
      type: "transfer",
      currency: "THB",
      walletId: wallet.id,
      destinationWalletId: bank.id,
      categoryId: null,
      amount: 100n,
      transactionDate: "2026-09-05",
      note: "",
    } satisfies CreateTransactionInput;
    const created = await createTransaction(db, input);
    if (!created.ok) {
      throw new Error("Transfer failed");
    }
    await db
      .update(wallets)
      .set({ archivedAt: new Date() })
      .where(eq(wallets.userId, owner.id));
    const rejected = await createTransaction(db, {
      ...input,
      submissionKey: freshKey(),
    });
    expect(rejected).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "wallet-archived" }),
    });
    const id = created.value.transaction.id;
    expect(
      (await updateTransaction(db, { ...input, id, amount: 200n })).ok,
    ).toBe(true);
    expect(
      (
        await updateTransaction(db, {
          ...input,
          id,
          walletId: bank.id,
          destinationWalletId: wallet.id,
          amount: 300n,
        })
      ).ok,
    ).toBe(true);
    expect(
      await updateTransaction(db, {
        ...input,
        id,
        destinationWalletId: other.id,
      }),
    ).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "wallet-archived" }),
    });
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_200_300n, -300n, 0n]);
  });
});

test("simultaneous duplicate transfers commit one pair of effects and changed destinations conflict", async () => {
  const db = committed();
  const { owner, wallet } = await setupOwner(db);
  const bank = await createWallet(db, {
    ownerId: owner.id,
    name: "Bank",
    type: "bank_account",
    openingAmount: 0n,
    openingDate: "2026-09-01",
  });
  const input = {
    ownerId: owner.id,
    submissionKey: freshKey(),
    type: "transfer",
    currency: "THB",
    walletId: wallet.id,
    destinationWalletId: bank.id,
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
  expect(await listTransactions(db, { ownerId: owner.id })).toHaveLength(1);
  expect(
    (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
  ).toEqual([-9_998_799_999n, 9_999_999_999n]);
  expect(
    await createTransaction(db, {
      ...input,
      walletId: bank.id,
      destinationWalletId: wallet.id,
    }),
  ).toEqual({ ok: false, error: { code: "submission-conflict" } });
  const again = await createTransaction(db, {
    ...input,
    submissionKey: freshKey(),
  });
  expect(again.ok && again.value.replayed).toBe(false);
  expect(
    (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
  ).toEqual([-19_998_799_998n, 19_999_999_998n]);
});

test("receipt or history write failures roll back both transfer effects and leave no partial receipt or history", async () => {
  await withRollback(async (db) => {
    const { owner, wallet } = await setupOwner(db);
    const bank = await createWallet(db, {
      ownerId: owner.id,
      name: "Bank",
      type: "bank_account",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    const input = {
      ownerId: owner.id,
      submissionKey: "fail-transfer-receipt",
      type: "transfer",
      currency: "THB",
      walletId: wallet.id,
      destinationWalletId: bank.id,
      categoryId: null,
      amount: 100_000n,
      transactionDate: "2026-09-05",
      note: "",
    } satisfies CreateTransactionInput;
    // Inject a storage fault at the receipt boundary, after the financial insert.
    // DDL lives in this rolled-back test transaction and never touches app databases.
    await db.execute(
      sql`alter table submission_receipts add constraint fail_transfer_receipt check (key <> 'fail-transfer-receipt')`,
    );
    await expect(createTransaction(db, input)).rejects.toThrow();
    expect(await listTransactions(db, { ownerId: owner.id })).toEqual([]);
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_200_000n, 0n]);
    await db.execute(
      sql`alter table submission_receipts drop constraint fail_transfer_receipt`,
    );
    const created = await createTransaction(db, input);
    if (!created.ok) {
      throw new Error("Transfer failed after storage recovered");
    }
    expect(created.value.replayed).toBe(false);
    const id = created.value.transaction.id;
    // A failed audit insert must undo the financial update or soft deletion.
    await db.execute(
      sql`alter table transaction_changes add constraint fail_transfer_history check (transaction_id is null) not valid`,
    );
    await expect(
      updateTransaction(db, {
        ...input,
        id,
        walletId: bank.id,
        destinationWalletId: wallet.id,
        amount: 200_000n,
      }),
    ).rejects.toThrow();
    await expect(
      deleteTransaction(db, { ownerId: owner.id, id }),
    ).rejects.toThrow();
    expect(await getTransaction(db, { ownerId: owner.id, id })).toEqual(
      created.value.transaction,
    );
    expect(await listTransactionChanges(db, { ownerId: owner.id, id })).toEqual(
      [],
    );
    expect(
      (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
    ).toEqual([1_100_000n, 100_000n]);
  });
});

describe("linked refunds", () => {
  /** A ฿500 groceries expense on 2 Sep from the owner's Cash wallet. */
  async function setupExpense(db: Database) {
    const context = await setupOwner(db);
    const created = await createTransaction(db, {
      ownerId: context.owner.id,
      submissionKey: freshKey(),
      type: "expense",
      walletId: context.wallet.id,
      categoryId: context.groceries.id,
      amount: 50_000n,
      transactionDate: "2026-09-02",
      note: "Weekly shop",
    });
    if (!created.ok) {
      throw new Error("Expense failed");
    }
    return { ...context, expense: created.value.transaction };
  }

  function refundInput(
    context: Readonly<{
      owner: { id: string };
      wallet: { id: string };
      expense: { id: string };
    }>,
    amount: bigint,
  ) {
    return {
      ownerId: context.owner.id,
      submissionKey: freshKey(),
      type: "refund",
      walletId: context.wallet.id,
      categoryId: null,
      refundOfTransactionId: context.expense.id,
      amount,
      transactionDate: "2026-09-03",
      note: "",
    } satisfies CreateTransactionInput;
  }

  test("partial refunds add to the receiving wallet, follow the expense category, and stop at the expense amount", async () => {
    await withRollback(async (db) => {
      const context = await setupExpense(db);
      const { owner, wallet, expense } = context;

      const first = await createTransaction(db, refundInput(context, 10_000n));
      expect(first.ok && first.value.transaction).toEqual(
        expect.objectContaining({
          type: "refund",
          amount: 10_000n,
          category: expect.objectContaining({
            name: "Groceries",
            parentName: "Food & Drink",
          }),
          refundOf: {
            id: expense.id,
            amount: 50_000n,
            transactionDate: "2026-09-02",
          },
        }),
      );
      const [summary] = await listWallets(db, { ownerId: owner.id });
      expect(summary?.balance).toBe(1_160_000n);
      expect(
        await getExpenseRefunds(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual({
        refunds: [
          expect.objectContaining({
            amount: 10_000n,
            transactionDate: "2026-09-03",
            wallet: expect.objectContaining({ id: wallet.id }),
          }),
        ],
        refundedTotal: 10_000n,
        remaining: 40_000n,
      });

      expect(
        await createTransaction(db, refundInput(context, 40_001n)),
      ).toEqual({
        ok: false,
        error: { code: "exceeds-refundable", remaining: 40_000n },
      });
      const rest = await createTransaction(db, refundInput(context, 40_000n));
      expect(rest.ok).toBe(true);
      expect(await createTransaction(db, refundInput(context, 1n))).toEqual({
        ok: false,
        error: { code: "exceeds-refundable", remaining: 0n },
      });
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_200_000n]);
      expect(
        (await listTransactions(db, { ownerId: owner.id })).map((t) => [
          t.type,
          t.amount,
        ]),
      ).toEqual([
        ["refund", 40_000n],
        ["refund", 10_000n],
        ["expense", 50_000n],
      ]);
    });
  });

  test("refund rules: dates follow the expense and receiving opening, wallets may differ but not be archived, and links must be the owner's own expense", async () => {
    await withRollback(async (db) => {
      const context = await setupExpense(db);
      const { owner, wallet, expense, groceries } = context;
      const bank = await createWallet(db, {
        ownerId: owner.id,
        name: "Bank",
        type: "bank_account",
        openingAmount: 0n,
        openingDate: "2026-09-04",
      });
      const retired = await createWallet(db, {
        ownerId: owner.id,
        name: "Retired",
        type: "cash",
        openingAmount: 0n,
        openingDate: "2026-09-01",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, retired.id));
      const foreign = await setupExpense(db);
      const income = await createTransaction(db, {
        ownerId: owner.id,
        submissionKey: freshKey(),
        type: "income",
        walletId: wallet.id,
        categoryId: context.salary.id,
        amount: 100n,
        transactionDate: "2026-09-02",
        note: "",
      });
      const base = refundInput(context, 10_000n);
      for (const [changes, error] of [
        [
          { transactionDate: "2026-09-01" },
          { code: "before-expense", expenseDate: "2026-09-02" },
        ],
        [
          { walletId: bank.id, transactionDate: "2026-09-03" },
          { code: "before-opening", openingDate: "2026-09-04" },
        ],
        [{ transactionDate: "9999-01-01" }, { code: "future-date" }],
        [{ walletId: retired.id }, { code: "wallet-archived" }],
        [{ walletId: foreign.wallet.id }, { code: "wallet-not-found" }],
        [
          { refundOfTransactionId: foreign.expense.id },
          { code: "expense-not-found" },
        ],
        [
          {
            refundOfTransactionId: income.ok ? income.value.transaction.id : "",
          },
          { code: "expense-not-found" },
        ],
        [{ refundOfTransactionId: null }, { code: "invalid-refund" }],
        [{ categoryId: groceries.id }, { code: "invalid-refund" }],
        [
          { type: "expense", categoryId: groceries.id },
          { code: "invalid-refund" },
        ],
        [{ amount: 0n }, { code: "amount-out-of-range" }],
      ] as const) {
        expect(await createTransaction(db, { ...base, ...changes })).toEqual({
          ok: false,
          error: expect.objectContaining(error),
        });
      }
      // Foreign owners cannot see the expense's refunds at all.
      expect(
        await getExpenseRefunds(db, {
          ownerId: foreign.owner.id,
          id: expense.id,
        }),
      ).toBeUndefined();

      const differentWallet = await createTransaction(db, {
        ...base,
        walletId: bank.id,
        transactionDate: "2026-09-04",
      });
      expect(differentWallet.ok).toBe(true);
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_150_100n, 10_000n, 0n]);
      expect(
        await listWallets(db, { ownerId: owner.id, asOf: "2026-09-03" }),
      ).toEqual([
        expect.objectContaining({ balance: 1_150_100n }),
        expect.objectContaining({ balance: 0n }),
        expect.objectContaining({ balance: 0n }),
      ]);
    });
  });

  test("refund edits exclude their own old amount, keep recording time and history, and cannot move to another archived wallet", async () => {
    await withRollback(async (db) => {
      const context = await setupExpense(db);
      const { owner, wallet, expense } = context;
      const bank = await createWallet(db, {
        ownerId: owner.id,
        name: "Bank",
        type: "bank_account",
        openingAmount: 0n,
        openingDate: "2026-09-01",
      });
      const retired = await createWallet(db, {
        ownerId: owner.id,
        name: "Retired",
        type: "cash",
        openingAmount: 0n,
        openingDate: "2026-09-01",
      });
      const first = await createTransaction(db, refundInput(context, 30_000n));
      const second = await createTransaction(db, refundInput(context, 10_000n));
      if (!first.ok || !second.ok) {
        throw new Error("Refunds failed");
      }
      const { id, recordedAt } = first.value.transaction;
      const base = {
        ownerId: owner.id,
        id,
        walletId: wallet.id,
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 30_000n,
        transactionDate: "2026-09-03",
        note: "",
      };
      // ฿10,000 is held by the other refund; this refund's own ฿30,000 is free.
      expect(await updateTransaction(db, { ...base, amount: 40_001n })).toEqual(
        {
          ok: false,
          error: { code: "exceeds-refundable", remaining: 40_000n },
        },
      );
      expect(
        await updateTransaction(db, { ...base, transactionDate: "2026-09-01" }),
      ).toEqual({
        ok: false,
        error: { code: "before-expense", expenseDate: "2026-09-02" },
      });
      const grown = await updateTransaction(db, {
        ...base,
        walletId: bank.id,
        amount: 40_000n,
        transactionDate: "2026-09-04",
      });
      expect(grown.ok && grown.value).toEqual(
        expect.objectContaining({
          recordedAt,
          amount: 40_000n,
          wallet: expect.objectContaining({ id: bank.id }),
          category: expect.objectContaining({ name: "Groceries" }),
          refundOf: expect.objectContaining({ id: expense.id }),
        }),
      );
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_160_000n, 40_000n, 0n]);

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(inArray(wallets.id, [bank.id, retired.id]));
      // Retaining its own archived wallet is allowed; another archived one is not.
      expect(
        (
          await updateTransaction(db, {
            ...base,
            walletId: bank.id,
            amount: 39_999n,
            transactionDate: "2026-09-04",
          })
        ).ok,
      ).toBe(true);
      expect(
        await updateTransaction(db, { ...base, walletId: retired.id }),
      ).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "wallet-archived" }),
      });
      const history = await listTransactionChanges(db, {
        ownerId: owner.id,
        id,
      });
      expect(history).toEqual([
        expect.objectContaining({
          action: "edit",
          before: expect.objectContaining({
            type: "refund",
            refundOfTransactionId: expense.id,
            amount: "30000",
          }),
          after: expect.objectContaining({
            walletId: bank.id,
            amount: "40000",
          }),
        }),
        expect.objectContaining({ action: "edit" }),
      ]);
      expect(await deleteTransaction(db, { ownerId: owner.id, id })).toEqual({
        ok: true,
        value: { id },
      });
      expect(
        await getExpenseRefunds(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 10_000n, remaining: 40_000n }),
      );
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_160_000n, 0n, 0n]);
    });
  });

  test("an expense with refunds cannot be deleted, reduced below the refunded total, or dated after a refund, and its category change follows through", async () => {
    await withRollback(async (db) => {
      const context = await setupExpense(db);
      const { owner, wallet, expense, expenseUncategorized } = context;
      const early = await createTransaction(db, refundInput(context, 10_000n));
      const late = await createTransaction(db, {
        ...refundInput(context, 5_000n),
        transactionDate: "2026-09-05",
      });
      if (!early.ok || !late.ok) {
        throw new Error("Refunds failed");
      }
      const base = {
        ownerId: owner.id,
        id: expense.id,
        walletId: wallet.id,
        categoryId: expense.category?.id ?? null,
        amount: 50_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      };
      expect(await updateTransaction(db, { ...base, amount: 14_999n })).toEqual(
        {
          ok: false,
          error: { code: "below-refunded", refundedTotal: 15_000n },
        },
      );
      expect(
        await updateTransaction(db, { ...base, transactionDate: "2026-09-04" }),
      ).toEqual({
        ok: false,
        error: { code: "after-refund", refundDate: "2026-09-03" },
      });
      expect(
        await deleteTransaction(db, { ownerId: owner.id, id: expense.id }),
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
        await listTransactionChanges(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual([]);

      const corrected = await updateTransaction(db, {
        ...base,
        categoryId: expenseUncategorized.id,
        amount: 15_000n,
        transactionDate: "2026-09-03",
      });
      expect(corrected.ok).toBe(true);
      expect(
        (await listTransactions(db, { ownerId: owner.id })).map((t) => [
          t.type,
          t.category?.name,
        ]),
      ).toEqual([
        ["refund", "Uncategorized"],
        ["refund", "Uncategorized"],
        ["expense", "Uncategorized"],
      ]);
      expect(
        await getExpenseRefunds(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 15_000n, remaining: 0n }),
      );
      // Refunds cannot be categorised on their own.
      expect(
        await updateTransaction(db, {
          ownerId: owner.id,
          id: early.value.transaction.id,
          walletId: wallet.id,
          categoryId: expenseUncategorized.id,
          amount: 10_000n,
          transactionDate: "2026-09-03",
          note: "",
        }),
      ).toEqual({ ok: false, error: { code: "invalid-refund" } });

      for (const refund of [early, late]) {
        await deleteTransaction(db, {
          ownerId: owner.id,
          id: refund.value.transaction.id,
        });
      }
      expect(
        await deleteTransaction(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual({ ok: true, value: { id: expense.id } });
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_200_000n]);
    });
  });

  test("competing refunds, expense reductions, and archiving serialize so committed records obey the limits", async () => {
    const db = committed();
    const context = await setupExpense(db);
    const { owner, wallet, expense } = context;
    const seventy = () => refundInput(context, 35_000n);
    const results = await Promise.all([
      createTransaction(db, seventy()),
      createTransaction(db, seventy()),
      createTransaction(db, seventy()),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: { code: "exceeds-refundable", remaining: 15_000n } },
      { ok: false, error: { code: "exceeds-refundable", remaining: 15_000n } },
    ]);

    // Same key and payload commits once even when raced.
    const duplicate = refundInput(context, 15_000n);
    const replays = await Promise.all(
      Array.from({ length: 4 }, () => createTransaction(db, duplicate)),
    );
    expect(replays.every((r) => r.ok)).toBe(true);
    expect(replays.filter((r) => r.ok && !r.value.replayed)).toHaveLength(1);
    expect(await createTransaction(db, { ...duplicate, amount: 1n })).toEqual({
      ok: false,
      error: { code: "submission-conflict" },
    });
    expect(
      await getExpenseRefunds(db, { ownerId: owner.id, id: expense.id }),
    ).toEqual(
      expect.objectContaining({ refundedTotal: 50_000n, remaining: 0n }),
    );

    // A refund deletion racing an expense reduction: whichever order the
    // database settles on, the committed state is consistent.
    const [firstRefund] = results.flatMap((r) =>
      r.ok ? [r.value.transaction] : [],
    );
    if (!firstRefund) {
      throw new Error("No refund committed");
    }
    const [deleted, reduced] = await Promise.all([
      deleteTransaction(db, { ownerId: owner.id, id: firstRefund.id }),
      updateTransaction(db, {
        ownerId: owner.id,
        id: expense.id,
        walletId: wallet.id,
        categoryId: expense.category?.id ?? null,
        amount: 15_000n,
        transactionDate: "2026-09-02",
        note: "Weekly shop",
      }),
    ]);
    expect(deleted.ok).toBe(true);
    const summary = await getExpenseRefunds(db, {
      ownerId: owner.id,
      id: expense.id,
    });
    const current = await getTransaction(db, {
      ownerId: owner.id,
      id: expense.id,
    });
    expect(summary?.refundedTotal).toBe(15_000n);
    expect(current?.amount).toBe(reduced.ok ? 15_000n : 50_000n);
    expect(current && summary && current.amount >= summary.refundedTotal).toBe(
      true,
    );

    // Archiving the receiving wallet blocks the next refund but not the
    // corrections of a refund already on it.
    const active = await createWallet(db, {
      ownerId: owner.id,
      name: "Bank",
      type: "bank_account",
      openingAmount: 0n,
      openingDate: "2026-09-01",
    });
    await db
      .update(wallets)
      .set({ archivedAt: new Date() })
      .where(eq(wallets.id, wallet.id));
    const [remaining] = summary?.refunds ?? [];
    if (!remaining) {
      throw new Error("Refund missing");
    }
    expect(
      (
        await updateTransaction(db, {
          ownerId: owner.id,
          id: remaining.id,
          walletId: wallet.id,
          categoryId: null,
          amount: 15_000n,
          transactionDate: "2026-09-06",
          note: "Late",
        })
      ).ok,
    ).toBe(true);
    expect(
      await createTransaction(db, {
        ...refundInput(context, 1n),
        walletId: wallet.id,
      }),
    ).toEqual({
      ok: false,
      error: { code: "wallet-archived", walletId: wallet.id },
    });
    const onActive = await createTransaction(db, {
      ...refundInput(context, 1n),
      walletId: active.id,
    });
    expect(onActive).toEqual(
      reduced.ok
        ? { ok: false, error: { code: "exceeds-refundable", remaining: 0n } }
        : { ok: true, value: expect.anything() },
    );
  });

  for (const operation of ["create", "edit"] as const) {
    for (const conflict of ["amount", "date", "delete", "archive"] as const) {
      test(`refund ${operation} racing ${conflict} preserves financial constraints and history`, async () => {
        const db = committed();
        const context = await setupExpense(db);
        const { owner, wallet, expense } = context;
        const receiver = await createWallet(db, {
          ownerId: owner.id,
          name: "Refund receiver",
          type: "bank_account",
          openingAmount: 0n,
          openingDate: "2026-09-01",
        });
        const existing =
          operation === "edit"
            ? await createTransaction(db, refundInput(context, 10_000n))
            : undefined;
        if (existing && !existing.ok) {
          throw new Error("Initial refund failed");
        }
        const refundId = existing?.ok
          ? existing.value.transaction.id
          : undefined;
        const refundWrite = refundId
          ? updateTransaction(db, {
              ownerId: owner.id,
              id: refundId,
              walletId: receiver.id,
              categoryId: null,
              amount: 40_000n,
              transactionDate: "2026-09-03",
              note: "Corrected refund",
            })
          : createTransaction(db, {
              ...refundInput(context, 40_000n),
              walletId: receiver.id,
            });
        const competingWrite =
          conflict === "archive"
            ? setWalletArchived(db, {
                ownerId: owner.id,
                id: receiver.id,
                archived: true,
              })
            : conflict === "delete"
              ? deleteTransaction(db, { ownerId: owner.id, id: expense.id })
              : updateTransaction(db, {
                  ownerId: owner.id,
                  id: expense.id,
                  walletId: wallet.id,
                  categoryId: expense.category?.id ?? null,
                  amount: conflict === "amount" ? 30_000n : expense.amount,
                  transactionDate:
                    conflict === "date"
                      ? "2026-09-04"
                      : expense.transactionDate,
                  note: expense.note,
                });
        const [refundResult, competingResult] = await Promise.all([
          refundWrite,
          competingWrite,
        ]);
        if (conflict === "archive") {
          expect(competingResult.ok).toBe(true);
          if (!refundResult.ok) {
            expect(refundResult.error).toEqual({
              code: "wallet-archived",
              walletId: receiver.id,
            });
          }
          expect(
            await createTransaction(db, {
              ...refundInput(context, 1n),
              walletId: receiver.id,
            }),
          ).toEqual({
            ok: false,
            error: { code: "wallet-archived", walletId: receiver.id },
          });
        } else if (
          operation === "edit" &&
          (conflict === "date" || conflict === "delete")
        ) {
          // Even the old refund blocks these expense changes.
          expect(refundResult.ok).toBe(true);
          expect(competingResult.ok).toBe(false);
        } else {
          expect(
            [refundResult.ok, competingResult.ok].filter(Boolean),
          ).toHaveLength(1);
        }
        const current = await getTransaction(db, {
          ownerId: owner.id,
          id: expense.id,
        });
        const summary = await getExpenseRefunds(db, {
          ownerId: owner.id,
          id: expense.id,
        });
        const expectedTotal = refundResult.ok
          ? 40_000n
          : operation === "edit"
            ? 10_000n
            : 0n;
        if (current && summary) {
          expect(summary.refundedTotal).toBe(expectedTotal);
          expect(current.amount).toBeGreaterThanOrEqual(summary.refundedTotal);
          expect(
            summary.refunds.every(
              (refund) => refund.transactionDate >= current.transactionDate,
            ),
          ).toBe(true);
        } else {
          expect(conflict).toBe("delete");
          expect(competingResult.ok).toBe(true);
          expect(expectedTotal).toBe(0n);
        }
        const balances = await listWallets(db, { ownerId: owner.id });
        expect(
          balances.find((entry) => entry.id === receiver.id)?.balance,
        ).toBe(refundResult.ok ? 40_000n : 0n);
        expect(balances.find((entry) => entry.id === wallet.id)?.balance).toBe(
          1_200_000n -
            (current?.amount ?? 0n) +
            (!refundResult.ok && operation === "edit" ? 10_000n : 0n),
        );
        expect(
          await listTransactionChanges(db, {
            ownerId: owner.id,
            id: expense.id,
          }),
        ).toHaveLength(competingResult.ok && conflict !== "archive" ? 1 : 0);
        if (refundId) {
          expect(
            await listTransactionChanges(db, {
              ownerId: owner.id,
              id: refundId,
            }),
          ).toHaveLength(refundResult.ok ? 1 : 0);
          expect(
            (await getTransaction(db, { ownerId: owner.id, id: refundId }))
              ?.recordedAt,
          ).toEqual(
            existing?.ok ? existing.value.transaction.recordedAt : undefined,
          );
        }
      });
    }
  }

  test("a failed history write rolls back refund corrections and expense guards leave no partial effect", async () => {
    await withRollback(async (db) => {
      const context = await setupExpense(db);
      const { owner, wallet, expense } = context;
      const refund = await createTransaction(db, refundInput(context, 20_000n));
      if (!refund.ok) {
        throw new Error("Refund failed");
      }
      const id = refund.value.transaction.id;
      await db.execute(
        sql`alter table transaction_changes add constraint fail_refund_history check (transaction_id is null) not valid`,
      );
      await expect(
        updateTransaction(db, {
          ownerId: owner.id,
          id,
          walletId: wallet.id,
          categoryId: null,
          amount: 30_000n,
          transactionDate: "2026-09-03",
          note: "",
        }),
      ).rejects.toThrow();
      await expect(
        deleteTransaction(db, { ownerId: owner.id, id }),
      ).rejects.toThrow();
      await db.execute(
        sql`alter table transaction_changes drop constraint fail_refund_history`,
      );
      expect(await getTransaction(db, { ownerId: owner.id, id })).toEqual(
        refund.value.transaction,
      );
      expect(
        await getExpenseRefunds(db, { ownerId: owner.id, id: expense.id }),
      ).toEqual(
        expect.objectContaining({ refundedTotal: 20_000n, remaining: 30_000n }),
      );
      expect(
        (await listWallets(db, { ownerId: owner.id })).map((w) => w.balance),
      ).toEqual([1_170_000n]);
      // Foreign owners cannot touch the refund or the expense's refund view.
      const foreign = await setupOwner(db);
      expect(
        await deleteTransaction(db, { ownerId: foreign.owner.id, id }),
      ).toEqual({ ok: false, error: { code: "transaction-not-found" } });
      expect(
        await listTransactionChanges(db, { ownerId: foreign.owner.id, id }),
      ).toEqual([]);
    });
  });
});
