import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import {
  createCategory,
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/category";

const { withRollback, committed } = setupTestDatabase();

async function setupOwner(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const tree = await listCategories(db, owner.id);
  function find(kind: "income" | "expense", name: string) {
    const found = tree.find((c) => c.kind === kind && c.name === name);
    if (!found) {
      throw new Error(`Missing ${kind} category ${name}`);
    }
    return found;
  }
  return { owner, find };
}

describe("category initialization", () => {
  test("a new user receives both default trees with one protected Uncategorized each", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      await initializeDefaultCategories(db, owner.id);
      const categories = await listCategories(db, owner.id);

      const protectedByKind = categories.filter((c) => c.isProtected);
      expect(
        protectedByKind.map((c) => [c.kind, c.name, c.parentId]).sort(),
      ).toEqual([
        ["expense", "Uncategorized", null],
        ["income", "Uncategorized", null],
      ]);
      expect(
        categories.find((c) => c.kind === "expense" && c.name === "Groceries"),
      ).toEqual(
        expect.objectContaining({
          parentId: categories.find((c) => c.name === "Food & Drink")?.id,
        }),
      );
      expect(
        categories.some((c) => c.kind === "income" && c.name === "Salary"),
      ).toBe(true);
      expect(categories.every((c) => c.iconId.length > 0)).toBe(true);
    });
  });

  test("repeated initialization neither duplicates seeds nor overwrites customization", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);
      const before = await listCategories(db, owner.id);
      const salary = before.find((c) => c.name === "Salary");
      if (!salary) {
        throw new Error("Expected Salary");
      }
      await db.execute(
        // A rename made by the user must survive re-initialization.
        `update categories set name = 'Wages' where id = '${salary.id}'`,
      );

      await initializeDefaultCategories(db, owner.id);
      const after = await listCategories(db, owner.id);

      expect(after).toHaveLength(before.length);
      expect(after.find((c) => c.id === salary.id)?.name).toBe("Wages");
      expect(after.some((c) => c.name === "Salary")).toBe(false);
    });
  });

  test("trees are isolated per user", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);
      await initializeDefaultCategories(db, alice.id);

      expect(await listCategories(db, bob.id)).toEqual([]);
    });
  });
});

describe("creating categories during entry", () => {
  test("a new parent and a child under it are listed in the owner's tree with their icons", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await initializeDefaultCategories(db, owner.id);

      const parent = await createCategory(db, {
        ownerId: owner.id,
        kind: "expense",
        name: "Drinks",
        iconId: "beer",
        parent: null,
      });
      if (!parent.ok) {
        throw new Error(`Parent rejected: ${parent.error.code}`);
      }
      const child = await createCategory(db, {
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

      const created = await createCategory(db, {
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

      const rejected = await createCategory(db, {
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
        return createCategory(db, {
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
        return createCategory(db, {
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
      expect(
        (await listCategories(db, owner.id)).some((c) => c.name === "Nested"),
      ).toBe(false);
    });
  });

  test("an icon outside the catalog is rejected rather than rewritten", async () => {
    await withRollback(async (db) => {
      const { owner } = await setupOwner(db);
      expect(
        await createCategory(db, {
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

  test("concurrent saves of the same parent name leave exactly one category", async () => {
    const db = committed();
    const { owner } = await setupOwner(db);

    const outcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        createCategory(db, {
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
