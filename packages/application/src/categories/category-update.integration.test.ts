import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { createCategoryForTest } from "../testing/category-fixture";
import { refused, setupOwner } from "../testing/category-suite-fixture";
import { findCategory, listCategories, updateCategory } from "./category";

const { withRollback } = setupTestDatabase();

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
      ).toEqual(refused("protected", "name"));

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

      expect(await attempt({ name: " restaurants ", iconId: "cart" })).toEqual(
        refused("duplicate-name", "name"),
      );
      expect(await attempt({ name: "   ", iconId: "cart" })).toEqual(
        refused("blank-name", "name"),
      );
      expect(
        await attempt({ name: "Groceries", iconId: "retired-glyph" }),
      ).toEqual(refused("unknown-icon", "iconId"));
      expect(await attempt({ name: "x".repeat(61), iconId: "cart" })).toEqual(
        refused("name-too-long", "name"),
      );
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
      for (const id of [foreign.id, crypto.randomUUID(), "not-a-uuid"]) {
        expect(
          await updateCategory(db, {
            ownerId: owner.id,
            id,
            name: "Mine",
            iconId: "bus",
          }),
        ).toEqual({ ok: false, error: { code: "not-found" } });
      }
      expect(
        await findCategory(db, { ownerId: owner.id, id: foreign.id }),
      ).toBeNull();
      expect(await stranger.find("expense", "Transport")).toEqual(
        expect.objectContaining({ id: foreign.id, name: "Transport" }),
      );
    });
  });
});
