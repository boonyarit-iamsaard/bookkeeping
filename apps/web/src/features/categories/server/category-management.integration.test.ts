import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import { createCategoryForTest as createCategory } from "@bookkeeping/application/testing/category-fixture";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import type { CategoryKind } from "@bookkeeping/domain/categories";
import { describe, expect, test } from "vitest";
import {
  listCategoryUsage,
  removeCategory,
  updateCategory,
} from "@/features/categories/server/category-management";
import type { CreateTransactionInput } from "@/features/transactions/server/transaction";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { openWallet } from "@/testing/wallet-fixture";

const { withRollback, committed } = setupTestDatabase();

async function setupOwner(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  async function find(kind: CategoryKind, name: string) {
    const found = (await listCategories(db, owner.id)).find(
      (c) => c.kind === kind && c.name === name,
    );
    if (!found) {
      throw new Error(`Missing ${kind} category ${name}`);
    }
    return found;
  }
  return { owner, find };
}

let keySequence = 0;
function freshKey() {
  keySequence += 1;
  return `key-${process.pid}-${Date.now()}-${keySequence}`;
}

/** An owner with one wallet, so expenses and refunds can be recorded. */
async function setupLedger(db: Database) {
  const context = await setupOwner(db);
  const wallet = await openWallet(db, {
    ownerId: context.owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 1_200_000n,
    openingDate: "2026-09-01",
  });
  async function record(
    fields: Readonly<
      Pick<CreateTransactionInput, "type" | "categoryId"> &
        Partial<CreateTransactionInput>
    >,
  ) {
    const result = await createTransaction(db, {
      ownerId: context.owner.id,
      submissionKey: freshKey(),
      walletId: wallet.id,
      amount: 50_000n,
      transactionDate: "2026-09-02",
      note: "",
      ...fields,
    });
    if (!result.ok) {
      throw new Error(`Transaction rejected: ${result.error.code}`);
    }
    return result.value.transaction;
  }
  return { ...context, wallet, record };
}

describe("renaming and changing icons", () => {
  test("a rename keeps the icon, and an icon change keeps the name, for either level", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const groceries = await find("expense", "Groceries");
      const transport = await find("expense", "Transport");

      const renamed = await updateCategory(db, {
        ownerId: owner.id,
        id: groceries.id,
        name: "  Supermarket ",
        iconId: groceries.iconId,
      });
      expect(renamed).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: groceries.id,
          name: "Supermarket",
          iconId: "cart",
          parentId: groceries.parentId,
        }),
      });
      const reiconed = await updateCategory(db, {
        ownerId: owner.id,
        id: transport.id,
        name: "Transport",
        iconId: "bus",
      });
      expect(reiconed.ok && reiconed.value).toEqual(
        expect.objectContaining({ name: "Transport", iconId: "bus" }),
      );

      expect(await find("expense", "Supermarket")).toEqual(
        expect.objectContaining({ id: groceries.id, iconId: "cart" }),
      );
      expect((await find("expense", "Transport")).iconId).toBe("bus");
    });
  });

  test("Uncategorized takes a new icon but never a new name; other rules match creation", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      const uncategorized = await find("expense", "Uncategorized");
      const groceries = await find("expense", "Groceries");
      function attempt(
        id: string,
        fields: Readonly<{ name: string; iconId?: string }>,
      ) {
        return updateCategory(db, {
          ownerId: owner.id,
          id,
          iconId: "generic",
          ...fields,
        });
      }

      const reiconed = await attempt(uncategorized.id, {
        name: "Uncategorized",
        iconId: "sparkles",
      });
      expect(reiconed.ok && reiconed.value).toEqual(
        expect.objectContaining({ iconId: "sparkles", isProtected: true }),
      );
      expect(await attempt(uncategorized.id, { name: "Misc" })).toEqual({
        ok: false,
        error: { code: "protected" },
      });
      expect(await attempt(groceries.id, { name: " restaurants " })).toEqual({
        ok: false,
        error: { code: "duplicate-name" },
      });
      expect(await attempt(groceries.id, { name: "food & drink" })).toEqual({
        ok: true,
        value: expect.objectContaining({ name: "food & drink" }),
      });
      expect(await attempt(groceries.id, { name: " " })).toEqual({
        ok: false,
        error: { code: "blank-name" },
      });
      expect(await attempt(groceries.id, { name: "x".repeat(61) })).toEqual({
        ok: false,
        error: { code: "name-too-long" },
      });
      expect(
        await attempt(groceries.id, {
          name: "Groceries",
          iconId: "retired-glyph",
        }),
      ).toEqual({ ok: false, error: { code: "unknown-icon" } });
      const foreign = await stranger.find("expense", "Transport");
      expect(await attempt(foreign.id, { name: "Mine" })).toEqual({
        ok: false,
        error: { code: "category-not-found" },
      });
      expect((await stranger.find("expense", "Transport")).id).toBe(foreign.id);
    });
  });
});

describe("removing categories", () => {
  test("a removed child hands its transactions to its parent, and linked refunds follow", async () => {
    await withRollback(async (db) => {
      const { owner, find, record } = await setupLedger(db);
      const groceries = await find("expense", "Groceries");
      const restaurants = await find("expense", "Restaurants");
      const foodAndDrink = await find("expense", "Food & Drink");
      const expense = await record({
        type: "expense",
        categoryId: groceries.id,
      });
      const refund = await record({
        type: "refund",
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 10_000n,
        transactionDate: "2026-09-03",
      });
      const untouched = await record({
        type: "expense",
        categoryId: restaurants.id,
      });

      const removed = await removeCategory(db, {
        ownerId: owner.id,
        id: groceries.id,
      });

      expect(removed).toEqual({
        ok: true,
        value: { fallbackId: foodAndDrink.id, reassigned: 1 },
      });
      const tree = await listCategories(db, owner.id);
      expect(tree.some((c) => c.id === groceries.id)).toBe(false);
      const owned = { ownerId: owner.id };
      expect(
        (await getTransaction(db, { ...owned, id: expense.id }))?.category,
      ).toEqual(
        expect.objectContaining({ id: foodAndDrink.id, parentName: null }),
      );
      expect(
        (await getTransaction(db, { ...owned, id: refund.id }))?.category,
      ).toEqual(expect.objectContaining({ id: foodAndDrink.id }));
      expect(
        (await getTransaction(db, { ...owned, id: untouched.id }))?.category
          ?.id,
      ).toBe(restaurants.id);
      expect(await listTransactions(db, { ownerId: owner.id })).toHaveLength(3);
    });
  });

  test("a parent is kept while any child exists; once childless its transactions fall back to Uncategorized", async () => {
    await withRollback(async (db) => {
      const { owner, find, record } = await setupLedger(db);
      const stranger = await setupOwner(db);
      const investment = await find("income", "Investment income");
      const dividends = await find("income", "Dividends");
      const interest = await find("income", "Interest");
      const uncategorized = await find("income", "Uncategorized");
      const direct = await record({
        type: "income",
        categoryId: investment.id,
      });
      const viaChild = await record({
        type: "income",
        categoryId: dividends.id,
      });
      function remove(id: string) {
        return removeCategory(db, { ownerId: owner.id, id });
      }

      // Interest is unused, and still blocks its parent.
      expect(await remove(investment.id)).toEqual({
        ok: false,
        error: { code: "has-children" },
      });
      expect(await remove(uncategorized.id)).toEqual({
        ok: false,
        error: { code: "protected" },
      });
      const foreign = await stranger.find("income", "Salary");
      expect(await remove(foreign.id)).toEqual({
        ok: false,
        error: { code: "category-not-found" },
      });
      expect((await stranger.find("income", "Salary")).id).toBe(foreign.id);

      expect(await remove(dividends.id)).toEqual({
        ok: true,
        value: { fallbackId: investment.id, reassigned: 1 },
      });
      expect(await remove(interest.id)).toEqual({
        ok: true,
        value: { fallbackId: investment.id, reassigned: 0 },
      });
      expect(await remove(investment.id)).toEqual({
        ok: true,
        value: { fallbackId: uncategorized.id, reassigned: 2 },
      });
      expect(await remove(investment.id)).toEqual({
        ok: false,
        error: { code: "category-not-found" },
      });

      const owned = { ownerId: owner.id };
      for (const id of [direct.id, viaChild.id]) {
        expect((await getTransaction(db, { ...owned, id }))?.category).toEqual(
          expect.objectContaining({
            id: uncategorized.id,
            name: "Uncategorized",
          }),
        );
      }
      const tree = await listCategories(db, owner.id);
      expect(tree.filter((c) => c.kind === "income" && c.isProtected)).toEqual([
        expect.objectContaining({ id: uncategorized.id }),
      ]);
      expect(
        tree.some((c) =>
          ["Investment income", "Dividends", "Interest"].includes(c.name),
        ),
      ).toBe(false);
      // Re-initialization does not bring the removed defaults back.
      await initializeDefaultCategories(db, owner.id);
      expect(await listCategories(db, owner.id)).toEqual(tree);
    });
  });

  test("removal racing a child creation or a transaction assignment ends with exactly one winner and no orphans", async () => {
    const db = committed();
    const { owner, wallet, find } = await setupLedger(db);
    const rounds = 6;
    const parents = await Promise.all(
      Array.from({ length: rounds }, async (_, round) => {
        const created = await createCategory(db, {
          ownerId: owner.id,
          kind: "expense",
          name: `Parent ${round}`,
          iconId: "generic",
          parent: null,
        });
        if (!created.ok) {
          throw new Error(created.error.code);
        }
        return created.value.category;
      }),
    );

    for (const parent of parents) {
      const [removed, child] = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: parent.id }),
        createCategory(db, {
          ownerId: owner.id,
          kind: "expense",
          name: "Late child",
          iconId: "generic",
          parent: { existingId: parent.id },
        }),
      ]);
      expect([removed.ok, child.ok].filter(Boolean)).toHaveLength(1);
      if (!removed.ok) {
        expect(removed.error).toEqual({ code: "has-children" });
      }
      if (!child.ok) {
        expect(child.error).toEqual({ code: "parent-not-found" });
      }
    }
    const tree = await listCategories(db, owner.id);
    for (const child of tree.filter((c) => c.name === "Late child")) {
      expect(tree.some((c) => c.id === child.parentId)).toBe(true);
    }

    const foodAndDrink = await find("expense", "Food & Drink");
    const children = await Promise.all(
      Array.from({ length: rounds }, async (_, round) => {
        const created = await createCategory(db, {
          ownerId: owner.id,
          kind: "expense",
          name: `Child ${round}`,
          iconId: "generic",
          parent: { existingId: foodAndDrink.id },
        });
        if (!created.ok) {
          throw new Error(created.error.code);
        }
        return created.value.category;
      }),
    );
    for (const child of children) {
      const [removed, expense] = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: child.id }),
        createTransaction(db, {
          ownerId: owner.id,
          submissionKey: freshKey(),
          type: "expense",
          walletId: wallet.id,
          categoryId: child.id,
          amount: 100n,
          transactionDate: "2026-09-02",
          note: "",
        }),
      ]);
      if (expense.ok) {
        // Either the removal moved it up, or it landed after the removal failed.
        expect([foodAndDrink.id, child.id]).toContain(
          expense.value.transaction.category?.id,
        );
        if (removed.ok) {
          expect(
            (
              await getTransaction(db, {
                ownerId: owner.id,
                id: expense.value.transaction.id,
              })
            )?.category?.id,
          ).toBe(foodAndDrink.id);
        } else {
          expect(removed.error).toEqual({ code: "in-use" });
        }
      } else {
        expect(expense.error).toEqual({ code: "category-not-found" });
        expect(removed.ok).toBe(true);
      }
    }
  });

  test("removal racing an expense edit onto it ends with the entry filed under a live category", async () => {
    const db = committed();
    const { owner, wallet, find, record } = await setupLedger(db);
    const foodAndDrink = await find("expense", "Food & Drink");
    const groceries = await find("expense", "Groceries");
    const rounds = 6;
    for (let round = 0; round < rounds; round += 1) {
      const created = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: `Snacks ${round}`,
        iconId: "generic",
        parent: { existingId: foodAndDrink.id },
      });
      if (!created.ok) {
        throw new Error(created.error.code);
      }
      const snacks = created.value.category;
      const expense = await record({
        type: "expense",
        categoryId: groceries.id,
      });
      const [removed, edited] = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: snacks.id }),
        updateTransaction(db, {
          ownerId: owner.id,
          id: expense.id,
          walletId: wallet.id,
          categoryId: snacks.id,
          amount: 70_000n,
          transactionDate: "2026-09-03",
          note: "",
        }),
      ]);
      const current = await getTransaction(db, {
        ownerId: owner.id,
        id: expense.id,
      });
      if (edited.ok) {
        // The edit landed; it is either still there or was moved up.
        expect(current?.category?.id).toBe(
          removed.ok ? foodAndDrink.id : snacks.id,
        );
        if (!removed.ok) {
          expect(removed.error).toEqual({ code: "in-use" });
        }
      } else {
        // The category vanished under the edit, which changed nothing.
        expect(edited.error).toEqual({ code: "category-not-found" });
        expect(removed.ok).toBe(true);
        expect(current?.category?.id).toBe(groceries.id);
        expect(current?.amount).toBe(50_000n);
      }
    }
  });

  test("two removals of the same category leave exactly one winner", async () => {
    const db = committed();
    const { owner, find, record } = await setupLedger(db);
    const foodAndDrink = await find("expense", "Food & Drink");
    const rounds = 6;
    for (let round = 0; round < rounds; round += 1) {
      const created = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: `Takeaway ${round}`,
        iconId: "generic",
        parent: { existingId: foodAndDrink.id },
      });
      if (!created.ok) {
        throw new Error(created.error.code);
      }
      const takeaway = created.value.category;
      await record({ type: "expense", categoryId: takeaway.id });
      const outcomes = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: takeaway.id }),
        removeCategory(db, { ownerId: owner.id, id: takeaway.id }),
      ]);
      const [winner, ...losers] = outcomes.filter((o) => o.ok);
      expect(winner).toEqual({
        ok: true,
        value: { fallbackId: foodAndDrink.id, reassigned: 1 },
      });
      expect(losers).toHaveLength(0);
      for (const outcome of outcomes.filter((o) => !o.ok)) {
        expect(outcome).toEqual({
          ok: false,
          error: { code: "category-not-found" },
        });
      }
    }
  });

  test("usage counts current income and expenses per category; refunds and deleted entries do not count", async () => {
    await withRollback(async (db) => {
      const { owner, find, record } = await setupLedger(db);
      const groceries = await find("expense", "Groceries");
      const salary = await find("income", "Salary");
      const expense = await record({
        type: "expense",
        categoryId: groceries.id,
      });
      await record({ type: "expense", categoryId: groceries.id });
      await record({
        type: "refund",
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 100n,
        transactionDate: "2026-09-03",
      });
      const gone = await record({ type: "income", categoryId: salary.id });
      await record({ type: "income", categoryId: salary.id });
      const deleted = await deleteTransaction(db, {
        ownerId: owner.id,
        id: gone.id,
      });
      expect(deleted.ok).toBe(true);

      expect(await listCategoryUsage(db, owner.id)).toEqual({
        [groceries.id]: 2,
        [salary.id]: 1,
      });
    });
  });
});
