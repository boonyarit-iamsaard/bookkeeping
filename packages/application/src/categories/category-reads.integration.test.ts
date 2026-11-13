import { categories } from "@bookkeeping/database/categories";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { UNCATEGORIZED_NAME } from "@bookkeeping/domain/categories";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { catalogSize, setupOwner } from "../testing/category-suite-fixture";
import {
  insertCategorizedTransaction,
  insertLinkedRefund,
} from "../testing/transaction-fixture";
import { createWalletForTest } from "../testing/wallet-fixture";
import {
  findCategory,
  findCategoryUsage,
  initializeDefaultCategories,
  listCategories,
  listCategoryUsage,
} from "./category";
import { DEFAULT_CATEGORIES } from "./default-categories";

const { withRollback } = setupTestDatabase();

describe("listCategories", () => {
  test("lists only the owner's ordered trees with protected metadata", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const stranger = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);
      await initializeDefaultCategories(db, stranger.id);

      const tree = await listCategories(db, owner.id);
      const foodAndDrink = tree.find(
        (category) => category.name === "Food & Drink",
      );
      const groceries = tree.find((category) => category.name === "Groceries");
      const strangerTree = await listCategories(db, stranger.id);
      if (!foodAndDrink || !groceries) {
        throw new Error("Expected the default expense categories");
      }

      expect(tree).toHaveLength(catalogSize("income") + catalogSize("expense"));
      expect(tree.filter((category) => category.isProtected)).toEqual([
        expect.objectContaining({
          kind: "income",
          name: UNCATEGORIZED_NAME,
          parentId: null,
        }),
        expect.objectContaining({
          kind: "expense",
          name: UNCATEGORIZED_NAME,
          parentId: null,
        }),
      ]);
      expect(foodAndDrink).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: null,
          isProtected: false,
        }),
      );
      expect(groceries).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: foodAndDrink?.id,
          isProtected: false,
        }),
      );
      expect(tree.indexOf(foodAndDrink)).toBeLessThan(tree.indexOf(groceries));
      expect(
        tree.some((category) =>
          strangerTree.some(
            (strangerCategory) => strangerCategory.id === category.id,
          ),
        ),
      ).toBe(false);
    });
  });

  test("does not initialize a missing tree while reading", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      expect(await listCategories(db, owner.id)).toEqual([]);
      expect(
        await db
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.userId, owner.id)),
      ).toEqual([]);
    });
  });
});
describe("findCategory", () => {
  test("returns an owned category and null for unknown, foreign, or malformed ids", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      const groceries = find("expense", "Groceries");

      expect(
        await findCategory(db, { ownerId: owner.id, id: groceries.id }),
      ).toEqual(groceries);
      expect(
        await findCategory(db, {
          ownerId: owner.id,
          id: stranger.find("expense", "Groceries").id,
        }),
      ).toBeNull();
      expect(
        await findCategory(db, {
          ownerId: owner.id,
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).toBeNull();
      expect(
        await findCategory(db, { ownerId: owner.id, id: "not-a-uuid" }),
      ).toBeNull();
    });
  });
});
describe("findCategoryUsage", () => {
  const foodAndDrinkChildren =
    DEFAULT_CATEGORIES.expense.find((parent) => parent.name === "Food & Drink")
      ?.children?.length ?? 0;

  test("counts current transactions and children; refunds and deleted transactions do not count", async () => {
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
      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: groceries.id,
        amount: 12_500n,
      });
      // A refund follows its expense's category, so it counts for neither.
      await insertLinkedRefund(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        refundOfTransactionId: expense,
      });
      const gone = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: restaurants.id,
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, gone));

      expect(
        await findCategoryUsage(db, { ownerId: owner.id, id: groceries.id }),
      ).toEqual({ transactions: 2, children: 0 });
      expect(
        await findCategoryUsage(db, { ownerId: owner.id, id: restaurants.id }),
      ).toEqual({ transactions: 0, children: 0 });
      // A parent reports its children beside its own transactions.
      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: foodAndDrink.id,
      });
      expect(
        await findCategoryUsage(db, { ownerId: owner.id, id: foodAndDrink.id }),
      ).toEqual({ transactions: 1, children: foodAndDrinkChildren });
    });
  });

  test("returns null for unknown, foreign, and malformed ids", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      const groceries = find("expense", "Groceries");

      expect(
        await findCategoryUsage(db, { ownerId: owner.id, id: groceries.id }),
      ).toEqual({ transactions: 0, children: 0 });
      expect(
        await findCategoryUsage(db, {
          ownerId: owner.id,
          id: stranger.find("expense", "Groceries").id,
        }),
      ).toBeNull();
      expect(
        await findCategoryUsage(db, {
          ownerId: owner.id,
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).toBeNull();
      expect(
        await findCategoryUsage(db, { ownerId: owner.id, id: "not-a-uuid" }),
      ).toBeNull();
    });
  });
});
describe("listCategoryUsage", () => {
  test("maps current transactions per category; unused categories are absent", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const wallet = await createWalletForTest(db, { ownerId: owner.id });
      const groceries = find("expense", "Groceries");
      const salary = find("income", "Salary");

      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: groceries.id,
      });
      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: groceries.id,
        amount: 7_500n,
      });
      await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: salary.id,
        type: "income",
      });
      const gone = await insertCategorizedTransaction(db, {
        ownerId: owner.id,
        walletId: wallet.id,
        categoryId: salary.id,
        type: "income",
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, gone));

      expect(await listCategoryUsage(db, owner.id)).toEqual({
        [groceries.id]: 2,
        [salary.id]: 1,
      });
    });
  });

  test("an owner without transactions has an empty usage map", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);

      expect(await listCategoryUsage(db, owner.id)).toEqual({});
    });
  });
});
