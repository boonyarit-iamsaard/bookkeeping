import { describe, expect, test, vi } from "vitest";
import type { Database } from "@/core/database/database";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/operations";
import {
  createTransaction,
  getTransaction,
  listTransactions,
} from "@/features/transactions/server/operations";
import {
  createWallet,
  listWallets,
} from "@/features/wallets/server/operations";
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
