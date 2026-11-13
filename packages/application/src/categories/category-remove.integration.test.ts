import type { Database } from "@bookkeeping/database/connection";
import {
  databaseError,
  FOREIGN_KEY_VIOLATION,
} from "@bookkeeping/database/errors";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createCategoryForTest } from "../testing/category-fixture";
import { refusal, setupOwner } from "../testing/category-suite-fixture";
import {
  insertCategorizedTransaction,
  insertLinkedRefund,
} from "../testing/transaction-fixture";
import { createWalletForTest } from "../testing/wallet-fixture";
import { initializeDefaultCategories, removeCategory } from "./category";
import { listCategories } from "./category-reads";

const { withRollback, committed } = setupTestDatabase();

/** Where one transaction is currently filed, deleted ones included. */
async function filedCategoryOf(db: Database, transactionId: string) {
  const [row] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  return row?.categoryId ?? null;
}

describe("removeCategory", () => {
  test("a removed child hands its transactions to its parent", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const wallet = await createWalletForTest(db, { ownerId: owner.id });
      const groceries = find("expense", "Groceries");
      const restaurants = find("expense", "Restaurants");
      const foodAndDrink = find("expense", "Food & Drink");
      const expense = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: groceries.id,
      });
      // A linked refund carries no category of its own and must not block.
      await insertLinkedRefund(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        refundOfTransactionId: expense,
      });
      const untouched = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
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
      expect(await listCategories(db, owner.id)).not.toContainEqual(
        expect.objectContaining({ id: groceries.id }),
      );
      expect(await filedCategoryOf(db, expense)).toBe(foodAndDrink.id);
      expect(await filedCategoryOf(db, untouched)).toBe(restaurants.id);
    });
  });

  test("a parent is kept while any child exists; once childless its transactions fall back to Uncategorized", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      const wallet = await createWalletForTest(db, { ownerId: owner.id });
      const investment = find("income", "Investment income");
      const dividends = find("income", "Dividends");
      const interest = find("income", "Interest");
      const uncategorized = find("income", "Uncategorized");
      const direct = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: investment.id,
        type: "income",
      });
      const viaChild = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: dividends.id,
        type: "income",
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
      const foreign = stranger.find("income", "Salary");
      expect(await remove(foreign.id)).toEqual({
        ok: false,
        error: { code: "not-found" },
      });
      expect(await remove("not-a-uuid")).toEqual({
        ok: false,
        error: { code: "not-found" },
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
        error: { code: "not-found" },
      });

      for (const id of [direct, viaChild]) {
        expect(await filedCategoryOf(db, id)).toBe(uncategorized.id);
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

  test("removal racing a child creation ends with exactly one winner and no orphans", async () => {
    const db = committed();
    const { owner } = await setupOwner(db);
    const rounds = 6;
    const parents = await Promise.all(
      Array.from({ length: rounds }, async (_, round) => {
        const created = await createCategoryForTest(db, {
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
        createCategoryForTest(db, {
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
        expect(child.error).toEqual(refusal("parent-not-found", "parent"));
      }
    }
    const tree = await listCategories(db, owner.id);
    for (const child of tree.filter((c) => c.name === "Late child")) {
      expect(tree.some((c) => c.id === child.parentId)).toBe(true);
    }
  });

  test("removal racing a transaction assignment ends with the entry filed under a live category", async () => {
    const db = committed();
    const { owner, find } = await setupOwner(db);
    const wallet = await createWalletForTest(db, { ownerId: owner.id });
    const foodAndDrink = find("expense", "Food & Drink");
    const rounds = 6;
    for (let round = 0; round < rounds; round += 1) {
      const created = await createCategoryForTest(db, {
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
      const [removed, inserted] = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: takeaway.id }),
        insertCategorizedTransaction(db, {
          ownerId: owner.id,
          walletId: wallet.id,
          categoryId: takeaway.id,
        }).then(
          (filed) => ({ filed }),
          (error: unknown) => ({ rejected: error }),
        ),
      ]);
      if ("filed" in inserted) {
        // Either the removal moved it up, or it kept the category and won.
        if (removed.ok) {
          expect(await filedCategoryOf(db, inserted.filed)).toBe(
            foodAndDrink.id,
          );
        } else {
          expect(removed.error).toEqual({ code: "in-use" });
          expect(await filedCategoryOf(db, inserted.filed)).toBe(takeaway.id);
          // Nothing changed: the removal rolled back whole.
          expect(
            (await listCategories(db, owner.id)).some(
              (c) => c.id === takeaway.id,
            ),
          ).toBe(true);
        }
      } else {
        // The category vanished under the insert; its restrict FK refused it.
        expect(databaseError(inserted.rejected)?.code).toBe(
          FOREIGN_KEY_VIOLATION,
        );
        expect(removed).toEqual({
          ok: true,
          value: { fallbackId: foodAndDrink.id, reassigned: 0 },
        });
      }
    }
  });

  test("two removals of the same category leave exactly one winner", async () => {
    const db = committed();
    const { owner, find } = await setupOwner(db);
    const wallet = await createWalletForTest(db, { ownerId: owner.id });
    const foodAndDrink = find("expense", "Food & Drink");
    const rounds = 6;
    for (let round = 0; round < rounds; round += 1) {
      const created = await createCategoryForTest(db, {
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
      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: snacks.id,
      });
      const outcomes = await Promise.all([
        removeCategory(db, { ownerId: owner.id, id: snacks.id }),
        removeCategory(db, { ownerId: owner.id, id: snacks.id }),
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
          error: { code: "not-found" },
        });
      }
    }
  });
});
