import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { StoredCreationResult, ValidatedPayload } from "./idempotency";
import { executeIdempotentCreation } from "./idempotency";

const { withRollback, committed } = setupTestDatabase();

const createdCategorySchema = z.object({ id: z.string(), name: z.string() });
type CreatedCategory = z.infer<typeof createdCategorySchema>;

const createdCategoryCodec = {
  encode(value: Readonly<CreatedCategory>): StoredCreationResult {
    return { id: value.id, name: value.name };
  },
  decode(value: unknown): CreatedCategory {
    return createdCategorySchema.parse(value);
  },
};

interface CreateCategoryOptions {
  db: Database;
  ownerId: string;
  key: string;
  name: string;
  operation?: string;
  payload?: ValidatedPayload;
  rejectWith?: "category-rejected";
}

async function createCategoryIdempotently({
  db,
  ownerId,
  key,
  name,
  operation = "categories.create",
  payload = { name },
  rejectWith,
}: Readonly<CreateCategoryOptions>) {
  return executeIdempotentCreation(db, {
    ownerId,
    operation,
    key,
    payload,
    resultCodec: createdCategoryCodec,
    create: async (tx) => {
      const [row] = await tx
        .insert(categories)
        .values({
          userId: ownerId,
          kind: "expense",
          name,
          iconId: "generic",
        })
        .returning({ id: categories.id, name: categories.name });
      if (!row) {
        throw new Error("Category insert returned no row");
      }
      if (rejectWith) {
        return { ok: false, error: { code: rejectWith } } as const;
      }
      return { ok: true, value: row } as const;
    },
  });
}

async function listOwnerCategories(db: Database, ownerId: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, ownerId));
}

describe("executeIdempotentCreation", () => {
  test("a sequential retry returns the original result after the resource changes or is removed", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const first = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "stable-result",
        name: "Travel",
      });
      if (!first.ok) {
        throw new Error("Expected category creation to succeed");
      }

      await db
        .update(categories)
        .set({ name: "Trips" })
        .where(eq(categories.id, first.value.result.id));
      const afterUpdate = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "stable-result",
        name: "Travel",
      });
      await db
        .delete(categories)
        .where(eq(categories.id, first.value.result.id));
      const afterDelete = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "stable-result",
        name: "Travel",
      });

      expect(first.value.replayed).toBe(false);
      expect(afterUpdate).toEqual({
        ok: true,
        value: { result: first.value.result, replayed: true },
      });
      expect(afterDelete).toEqual(afterUpdate);
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);
    });
  });

  test("a changed payload conflicts without creating another resource", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "changed-payload",
        name: "Travel",
      });

      const conflict = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "changed-payload",
        name: "Trips",
      });

      expect(conflict).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      expect(await listOwnerCategories(db, owner.id)).toEqual([
        expect.objectContaining({ name: "Travel" }),
      ]);
    });
  });

  test("the same key is independent across owners and operations", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);

      const outcomes = await Promise.all([
        createCategoryIdempotently({
          db,
          ownerId: alice.id,
          key: "shared-key",
          name: "Alice expense",
        }),
        createCategoryIdempotently({
          db,
          ownerId: alice.id,
          operation: "wallets.create",
          key: "shared-key",
          name: "Alice wallet result",
        }),
        createCategoryIdempotently({
          db,
          ownerId: bob.id,
          key: "shared-key",
          name: "Bob expense",
        }),
      ]);

      expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
      expect(await listOwnerCategories(db, alice.id)).toHaveLength(2);
      expect(await listOwnerCategories(db, bob.id)).toHaveLength(1);
    });
  });

  test("concurrent retries commit one resource and replay one result", async () => {
    const db = committed();
    const owner = await createTestUser(db);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        createCategoryIdempotently({
          db,
          ownerId: owner.id,
          key: "concurrent-create",
          name: "Concurrent",
        }),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
    const successes = outcomes.filter((outcome) => outcome.ok);
    expect(
      new Set(successes.map((outcome) => outcome.value.result.id)).size,
    ).toBe(1);
    expect(successes.filter((outcome) => !outcome.value.replayed)).toHaveLength(
      1,
    );
    expect(await listOwnerCategories(db, owner.id)).toHaveLength(1);
  });

  test("an application rejection rolls back its writes and does not consume the key", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const rejected = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "correctable",
        name: "Rejected",
        rejectWith: "category-rejected",
      });
      expect(rejected).toEqual({
        ok: false,
        error: { code: "category-rejected" },
      });
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);

      const corrected = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "correctable",
        name: "Corrected",
      });
      expect(corrected.ok && corrected.value.replayed).toBe(false);
      expect(await listOwnerCategories(db, owner.id)).toEqual([
        expect.objectContaining({ name: "Corrected" }),
      ]);
    });
  });

  test("a receipt failure rolls back the created resource and leaves the key reusable", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await db.execute(
        sql`alter table creation_receipts add constraint reject_receipt check (key <> 'receipt-failure')`,
      );

      await expect(
        createCategoryIdempotently({
          db,
          ownerId: owner.id,
          key: "receipt-failure",
          name: "Atomic",
        }),
      ).rejects.toThrow();
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);

      await db.execute(
        sql`alter table creation_receipts drop constraint reject_receipt`,
      );
      const retry = await createCategoryIdempotently({
        db,
        ownerId: owner.id,
        key: "receipt-failure",
        name: "Atomic",
      });

      expect(retry.ok && retry.value.replayed).toBe(false);
      expect(
        await db
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(eq(categories.userId, owner.id), eq(categories.name, "Atomic")),
          ),
      ).toHaveLength(1);
    });
  });
});
