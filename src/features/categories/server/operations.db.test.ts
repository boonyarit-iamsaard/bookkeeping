import { describe, expect, test } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/operations";
import {
  createTestUser,
  setupTestDatabase,
} from "../../../../tests/database/test-database";

const { withRollback } = setupTestDatabase();

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
