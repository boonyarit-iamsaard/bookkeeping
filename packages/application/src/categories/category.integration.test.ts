import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { databaseError } from "@bookkeeping/database/errors";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import type { CategoryKind } from "@bookkeeping/domain/categories";
import {
  GENERIC_ICON_ID,
  UNCATEGORIZED_NAME,
} from "@bookkeeping/domain/categories";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createCategoryForTest } from "../testing/category-fixture";
import {
  insertCategorizedTransaction,
  insertLinkedRefund,
} from "../testing/transaction-fixture";
import { createWalletForTest } from "../testing/wallet-fixture";
import {
  createCategory,
  findCategory,
  findCategoryUsage,
  initializeDefaultCategories,
  listCategories,
  listCategoryUsage,
  removeCategory,
  updateCategory,
} from "./category";
import { DEFAULT_CATEGORIES } from "./default-categories";

const { withRollback, committed } = setupTestDatabase();

async function setupOwner(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const tree = await listCategories(db, owner.id);
  function find(kind: CategoryKind, name: string) {
    const found = tree.find((c) => c.kind === kind && c.name === name);
    if (!found) {
      throw new Error(`Missing ${kind} category ${name}`);
    }
    return found;
  }
  return { owner, find };
}

async function listTree(db: Database, ownerId: string) {
  return db
    .select({
      id: categories.id,
      kind: categories.kind,
      parentId: categories.parentId,
      name: categories.name,
      iconId: categories.iconId,
      isProtected: categories.isProtected,
    })
    .from(categories)
    .where(eq(categories.userId, ownerId))
    .orderBy(
      asc(categories.kind),
      asc(categories.sortOrder),
      asc(categories.name),
    );
}

function catalogSize(kind: CategoryKind) {
  return DEFAULT_CATEGORIES[kind].reduce(
    (count, parent) => count + 1 + (parent.children?.length ?? 0),
    1, // Uncategorized
  );
}

/** Where one transaction is currently filed, deleted ones included. */
async function filedCategoryOf(db: Database, transactionId: string) {
  const [row] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  return row?.categoryId ?? null;
}

describe("initializeDefaultCategories", () => {
  test("a fresh user receives the complete default set with one protected Uncategorized per tree", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      const outcome = await initializeDefaultCategories(db, owner.id);
      const tree = await listTree(db, owner.id);

      expect(outcome).toEqual({ seededKinds: ["income", "expense"] });
      expect(tree.filter((c) => c.kind === "income")).toHaveLength(
        catalogSize("income"),
      );
      expect(tree.filter((c) => c.kind === "expense")).toHaveLength(
        catalogSize("expense"),
      );
      expect(
        tree
          .filter((c) => c.isProtected)
          .map((c) => [c.kind, c.name, c.parentId])
          .sort(),
      ).toEqual([
        ["expense", UNCATEGORIZED_NAME, null],
        ["income", UNCATEGORIZED_NAME, null],
      ]);
      const foodAndDrink = tree.find((c) => c.name === "Food & Drink");
      expect(tree.find((c) => c.name === "Groceries")).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: foodAndDrink?.id,
          iconId: "cart",
        }),
      );
      expect(tree.find((c) => c.name === "Salary")).toEqual(
        expect.objectContaining({ kind: "income", parentId: null }),
      );
    });
  });

  test("a failure while seeding one tree rolls back the whole set", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      // An unprotected expense tree whose only member clashes with a default
      // name: seeding expense trips the scoped name index after income landed.
      await db.insert(categories).values({
        userId: owner.id,
        kind: "expense",
        name: "transport",
        iconId: GENERIC_ICON_ID,
      });

      await expect(initializeDefaultCategories(db, owner.id)).rejects.toThrow();

      const tree = await listTree(db, owner.id);
      expect(tree.map((c) => [c.kind, c.name])).toEqual([
        ["expense", "transport"],
      ]);
    });
  });

  test("repeating provisioning neither duplicates defaults nor overwrites customization", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);
      const before = await listTree(db, owner.id);
      const salary = before.find((c) => c.name === "Salary");
      if (!salary) {
        throw new Error("Expected Salary");
      }
      await db
        .update(categories)
        .set({ name: "Wages" })
        .where(eq(categories.id, salary.id));
      await db.delete(categories).where(eq(categories.name, "Bonus"));

      const again = await initializeDefaultCategories(db, owner.id);
      const after = await listTree(db, owner.id);

      expect(again).toEqual({ seededKinds: [] });
      expect(after).toHaveLength(before.length - 1);
      expect(after.find((c) => c.id === salary.id)?.name).toBe("Wages");
      expect(after.some((c) => c.name === "Salary")).toBe(false);
      expect(after.some((c) => c.name === "Bonus")).toBe(false);
    });
  });

  test("a tree that lost its defaults but kept Uncategorized is not reseeded", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);
      await db
        .delete(categories)
        .where(
          and(
            eq(categories.userId, owner.id),
            eq(categories.kind, "income"),
            eq(categories.isProtected, false),
          ),
        );

      const outcome = await initializeDefaultCategories(db, owner.id);

      expect(outcome).toEqual({ seededKinds: [] });
      expect(
        (await listTree(db, owner.id)).filter((c) => c.kind === "income"),
      ).toEqual([expect.objectContaining({ name: UNCATEGORIZED_NAME })]);
    });
  });

  test("concurrent provisioning of one owner seeds each tree exactly once", async () => {
    const db = committed();
    const owner = await createTestUser(db);

    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        initializeDefaultCategories(db, owner.id),
      ),
    );

    expect(outcomes.flatMap((o) => o.seededKinds).sort()).toEqual([
      "expense",
      "income",
    ]);
    const tree = await listTree(db, owner.id);
    expect(tree).toHaveLength(catalogSize("income") + catalogSize("expense"));
  });

  test("provisioning one owner leaves other owners untouched", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);

      await initializeDefaultCategories(db, alice.id);

      expect(await listTree(db, bob.id)).toEqual([]);
      const seeded = await initializeDefaultCategories(db, bob.id);
      expect(seeded).toEqual({ seededKinds: ["income", "expense"] });
      const aliceTree = await listTree(db, alice.id);
      const bobTree = await listTree(db, bob.id);
      expect(bobTree).toHaveLength(aliceTree.length);
      expect(bobTree.some((c) => aliceTree.some((a) => a.id === c.id))).toBe(
        false,
      );
    });
  });
});

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

describe("createCategory", () => {
  test("creates a parent and replays the same normalized command", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);

      const first = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "  Subscriptions  ",
        iconId: "tv",
        parent: null,
        idempotencyKey: "category-retry",
      });
      const retry = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Subscriptions",
        iconId: "tv",
        parent: null,
        idempotencyKey: "category-retry",
      });

      expect(first.ok).toBe(true);
      expect(retry).toEqual({
        ok: true,
        value: first.ok
          ? { ...first.value, replayed: true }
          : expect.anything(),
      });
      expect(
        (await listCategories(db, owner.id)).filter(
          (category) => category.name === "Subscriptions",
        ),
      ).toHaveLength(1);
    });
  });

  test("rejects changed payloads under an existing key without another row", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const input = {
        ownerId: owner.id,
        kind: "expense" as const,
        name: "Subscriptions",
        iconId: "tv",
        parent: null,
        idempotencyKey: "category-conflict",
      };

      await expect(createCategory(db, input)).resolves.toMatchObject({
        ok: true,
      });
      expect(await createCategory(db, { ...input, iconId: "film" })).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      expect(
        (await listCategories(db, owner.id)).filter(
          (category) => category.name === "Subscriptions",
        ),
      ).toHaveLength(1);
    });
  });

  test("does not consume a key when validation rejects the command", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const rejected = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "   ",
        iconId: "coffee",
        parent: null,
        idempotencyKey: "category-validation",
      });
      const corrected = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Coffee",
        iconId: "coffee",
        parent: null,
        idempotencyKey: "category-validation",
      });

      expect(rejected).toEqual({
        ok: false,
        error: { code: "blank-name", field: "name" },
      });
      expect(corrected).toMatchObject({
        ok: true,
        value: { replayed: false },
      });
    });
  });

  test("concurrent retries with one key create one category and replay it", async () => {
    const db = committed();
    const owner = await createTestUser(db);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        createCategory(db, {
          ownerId: owner.id,
          kind: "expense",
          name: "Subscriptions",
          iconId: "tv",
          parent: null,
          idempotencyKey: "category-concurrent",
        }),
      ),
    );

    const successes = outcomes.flatMap((outcome) =>
      outcome.ok ? [outcome.value] : [],
    );
    expect(successes).toHaveLength(5);
    expect(new Set(successes.map(({ category }) => category.id)).size).toBe(1);
    expect(successes.filter(({ replayed }) => !replayed)).toHaveLength(1);
    expect(
      (await listCategories(db, owner.id)).filter(
        (category) => category.name === "Subscriptions",
      ),
    ).toHaveLength(1);
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

describe("updateCategory", () => {
  test("a rename keeps the icon, and an icon change keeps the name, at either level", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const groceries = find("expense", "Groceries");
      const transport = find("expense", "Transport");

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
          kind: "expense",
          parentId: groceries.parentId,
          name: "Supermarket",
          iconId: "cart",
          isProtected: false,
        }),
      });
      const reiconed = await updateCategory(db, {
        ownerId: owner.id,
        id: transport.id,
        name: "Transport",
        iconId: "bus",
      });
      expect(reiconed).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: transport.id,
          parentId: null,
          name: "Transport",
          iconId: "bus",
        }),
      });

      const listed = await listCategories(db, owner.id);
      expect(listed.find((category) => category.id === groceries.id)).toEqual(
        expect.objectContaining({ name: "Supermarket", iconId: "cart" }),
      );
      expect(listed.find((category) => category.id === transport.id)).toEqual(
        expect.objectContaining({ name: "Transport", iconId: "bus" }),
      );
    });
  });

  test("an update never moves the tree position or changes the kind", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);
      const created = await createCategoryForTest(db, {
        ownerId: owner.id,
        kind: "income",
        name: "Royalties",
        iconId: "trending",
        parent: null,
      });
      if (!created.ok) {
        throw new Error(`Rejected: ${created.error.code}`);
      }
      const royalties = created.value.category;

      const updated = await updateCategory(db, {
        ownerId: owner.id,
        id: royalties.id,
        name: "Licensing",
        iconId: "coins",
      });

      expect(updated).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: royalties.id,
          kind: "income",
          parentId: null,
        }),
      });
    });
  });

  test("Uncategorized takes a new icon but never a new name", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const uncategorized = find("expense", "Uncategorized");

      const reiconed = await updateCategory(db, {
        ownerId: owner.id,
        id: uncategorized.id,
        name: "Uncategorized",
        iconId: "sparkles",
      });
      expect(reiconed).toEqual({
        ok: true,
        value: expect.objectContaining({
          id: uncategorized.id,
          iconId: "sparkles",
          isProtected: true,
        }),
      });
      expect(
        await updateCategory(db, {
          ownerId: owner.id,
          id: uncategorized.id,
          name: "Misc",
          iconId: "sparkles",
        }),
      ).toEqual({ ok: false, error: { code: "protected" } });

      const listed = await listCategories(db, owner.id);
      expect(
        listed.find((category) => category.id === uncategorized.id),
      ).toEqual(
        expect.objectContaining({
          name: "Uncategorized",
          iconId: "sparkles",
          isProtected: true,
        }),
      );
    });
  });

  test("rejections match the creation rules without touching the row", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      const groceries = find("expense", "Groceries");
      function attempt(fields: Readonly<{ name: string; iconId: string }>) {
        return updateCategory(db, {
          ownerId: owner.id,
          id: groceries.id,
          ...fields,
        });
      }

      expect(await attempt({ name: " restaurants ", iconId: "cart" })).toEqual({
        ok: false,
        error: { code: "duplicate-name" },
      });
      expect(await attempt({ name: "   ", iconId: "cart" })).toEqual({
        ok: false,
        error: { code: "blank-name" },
      });
      expect(
        await attempt({ name: "Groceries", iconId: "retired-glyph" }),
      ).toEqual({
        ok: false,
        error: { code: "unknown-icon" },
      });
      expect(await attempt({ name: "x".repeat(61), iconId: "cart" })).toEqual({
        ok: false,
        error: { code: "name-too-long" },
      });
      // Every rejection left the row as it was.
      expect(
        await findCategory(db, { ownerId: owner.id, id: groceries.id }),
      ).toEqual(groceries);
      // The current name updates cleanly under its own case.
      expect(await attempt({ name: " groceries ", iconId: "cart" })).toEqual({
        ok: true,
        value: expect.objectContaining({ name: "groceries" }),
      });

      const foreign = stranger.find("expense", "Transport");
      expect(
        await updateCategory(db, {
          ownerId: owner.id,
          id: foreign.id,
          name: "Mine",
          iconId: "bus",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await updateCategory(db, {
          ownerId: owner.id,
          id: "00000000-0000-0000-0000-000000000000",
          name: "Mine",
          iconId: "bus",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await updateCategory(db, {
          ownerId: owner.id,
          id: "not-a-uuid",
          name: "Mine",
          iconId: "bus",
        }),
      ).toEqual({ ok: false, error: { code: "category-not-found" } });
      expect(
        await findCategory(db, { ownerId: owner.id, id: foreign.id }),
      ).toBeNull();
      expect(await stranger.find("expense", "Transport")).toEqual(
        expect.objectContaining({ id: foreign.id, name: "Transport" }),
      );
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

describe("createCategory tree rules", () => {
  test("a new parent and a child under it are listed in the owner's tree with their icons", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);

      const parent = await createCategoryForTest(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Drinks",
        iconId: "beer",
        parent: null,
      });
      if (!parent.ok) {
        throw new Error(`Parent rejected: ${parent.error.code}`);
      }
      const child = await createCategoryForTest(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Bubble tea",
        iconId: "coffee",
        parent: { existingId: parent.value.category.id },
      });
      if (!child.ok) {
        throw new Error(`Child rejected: ${child.error.code}`);
      }

      const listed = await listCategories(db, owner.id);
      expect(listed.find((c) => c.id === parent.value.category.id)).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: null,
          name: "Drinks",
          iconId: "beer",
          isProtected: false,
        }),
      );
      expect(listed.find((c) => c.id === child.value.category.id)).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: parent.value.category.id,
          name: "Bubble tea",
          iconId: "coffee",
        }),
      );
      expect(child.value.createdParent).toBeUndefined();
    });
  });

  test("a missing parent is created with its child, or neither when the parent name is taken", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);

      const created = await createCategoryForTest(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Bubble tea",
        iconId: "coffee",
        parent: { create: { name: "Drinks", iconId: "beer" } },
      });
      if (!created.ok) {
        throw new Error(`Rejected: ${created.error.code}`);
      }
      expect(created.value.createdParent).toEqual(
        expect.objectContaining({
          name: "Drinks",
          iconId: "beer",
          parentId: null,
        }),
      );
      expect(created.value.category.parentId).toBe(
        created.value.createdParent?.id,
      );

      const rejected = await createCategoryForTest(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Lunch",
        iconId: "utensils",
        parent: { create: { name: "food & drink", iconId: "utensils" } },
      });
      expect(rejected).toEqual({
        ok: false,
        error: { code: "duplicate-name", field: "parentName" },
      });
      const listed = await listCategories(db, owner.id);
      expect(listed.some((c) => c.name === "Lunch")).toBe(false);
      expect(
        listed.filter((c) => c.name.toLowerCase() === "food & drink"),
      ).toHaveLength(1);
    });
  });

  test("names are trimmed and compared case-insensitively within their scope; blank names fail", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const foodAndDrink = find("expense", "Food & Drink");
      function attempt(name: string, parentId: string | null) {
        return createCategoryForTest(db, {
          ownerId: owner.id,
          kind: "expense",
          name,
          iconId: "generic",
          parent: parentId ? { existingId: parentId } : null,
        });
      }

      expect(await attempt("  groceries ", foodAndDrink.id)).toEqual({
        ok: false,
        error: { code: "duplicate-name", field: "name" },
      });
      expect(await attempt("FOOD & DRINK", null)).toEqual({
        ok: false,
        error: { code: "duplicate-name", field: "name" },
      });
      expect(await attempt("uncategorized", null)).toEqual({
        ok: false,
        error: { code: "duplicate-name", field: "name" },
      });
      expect(await attempt("   ", null)).toEqual({
        ok: false,
        error: { code: "blank-name", field: "name" },
      });
      expect(await attempt("x".repeat(61), null)).toEqual({
        ok: false,
        error: { code: "name-too-long", field: "name" },
      });
      // Same name in a different scope: a parent, and a child elsewhere.
      const asParent = await attempt("  Groceries  ", null);
      expect(asParent.ok && asParent.value.category.name).toBe("Groceries");
      const underTransport = await attempt(
        "Groceries",
        find("expense", "Transport").id,
      );
      expect(underTransport.ok).toBe(true);
      // The protected parent is untouched.
      expect(find("expense", "Uncategorized")).toEqual(
        expect.objectContaining({ isProtected: true, parentId: null }),
      );
    });
  });

  test("children only go under the owner's own top-level parent of the same tree, never under Uncategorized", async () => {
    await withRollback(async (db) => {
      const { owner, find } = await setupOwner(db);
      const stranger = await setupOwner(db);
      function attempt(parentId: string) {
        return createCategoryForTest(db, {
          ownerId: owner.id,
          kind: "expense",
          name: "Nested",
          iconId: "generic",
          parent: { existingId: parentId },
        });
      }

      expect(await attempt(find("expense", "Groceries").id)).toEqual({
        ok: false,
        error: { code: "parent-is-child" },
      });
      expect(await attempt(find("expense", "Uncategorized").id)).toEqual({
        ok: false,
        error: { code: "parent-protected" },
      });
      expect(await attempt(find("income", "Salary").id)).toEqual({
        ok: false,
        error: { code: "parent-not-found" },
      });
      expect(await attempt(stranger.find("expense", "Transport").id)).toEqual({
        ok: false,
        error: { code: "parent-not-found" },
      });
      expect(await attempt("not-a-uuid")).toEqual({
        ok: false,
        error: { code: "parent-not-found" },
      });
      expect(
        (await listCategories(db, owner.id)).some((c) => c.name === "Nested"),
      ).toBe(false);
    });
  });

  test("an icon outside the catalog is rejected rather than rewritten", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);
      expect(
        await createCategoryForTest(db, {
          ownerId: owner.id,
          kind: "income",
          name: "Royalties",
          iconId: "retired-glyph",
          parent: null,
        }),
      ).toEqual({
        ok: false,
        error: { code: "unknown-icon", field: "iconId" },
      });
    });
  });

  test("concurrent saves of the same parent name under different keys leave exactly one category", async () => {
    const db = committed();
    const { owner } = await setupOwner(db);

    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        createCategoryForTest(db, {
          ownerId: owner.id,
          kind: "expense",
          name: "Subscriptions",
          iconId: "tv",
          parent: null,
        }),
      ),
    );

    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok).map((o) => !o.ok && o.error)).toEqual(
      Array.from({ length: 3 }, () => ({
        code: "duplicate-name",
        field: "name",
      })),
    );
    const listed = await listCategories(db, owner.id);
    expect(listed.filter((c) => c.name === "Subscriptions")).toHaveLength(1);
  });
});

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
        expect(child.error).toEqual({ code: "parent-not-found" });
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
        expect(databaseError(inserted.rejected)?.code).toBe("23503");
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
          error: { code: "category-not-found" },
        });
      }
    }
  });
});
