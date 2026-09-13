import { describe, expect, test, vi } from "vitest";
import type { Database } from "@/core/database/database";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/category";
import type { CreateTransactionInput } from "@/features/transactions/server/transaction";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactionChanges,
  listTransactions,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { createWallet, listWallets } from "@/features/wallets/server/wallet";
import {
  createTestUser,
  setupTestDatabase,
} from "../../../../tests/database/test-database";

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

      const listed = await listTransactions(db, owner.id);
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
      expect(await listTransactions(db, owner.id)).toEqual([]);
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
      expect(await listTransactions(db, bob.owner.id)).toEqual([]);
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
      expect(await listTransactions(db, owner.id)).toHaveLength(2);
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
      const listed = await listTransactions(db, owner.id);
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
    expect(await listTransactions(db, owner.id)).toHaveLength(1);
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
      expect(await listTransactions(db, owner.owner.id)).toHaveLength(1);
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
        (await listTransactions(db, owner.owner.id)).map((t) => t.id),
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
      expect(await listTransactions(db, owner.owner.id)).toHaveLength(1);

      await deleteTransaction(db, {
        ownerId: owner.owner.id,
        id: transaction.id,
      });
      const afterDelete = await createTransaction(db, input);
      expect(afterDelete.ok && afterDelete.value.replayed).toBe(true);
      expect(afterDelete.ok && afterDelete.value.transaction.id).toBe(
        transaction.id,
      );
      expect(await listTransactions(db, owner.owner.id)).toEqual([]);
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
