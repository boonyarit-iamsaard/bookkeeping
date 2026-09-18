import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import type { CategoryKind } from "@bookkeeping/domain/categories";
import {
  GENERIC_ICON_ID,
  UNCATEGORIZED_NAME,
} from "@bookkeeping/domain/categories";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { initializeDefaultCategories, listCategories } from "./category";
import { DEFAULT_CATEGORIES } from "./default-categories";

const { withRollback, committed } = setupTestDatabase();

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
