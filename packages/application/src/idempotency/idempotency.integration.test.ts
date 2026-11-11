import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { creationReceipts } from "@bookkeeping/database/idempotency";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  CREATION_REPLAY_WINDOW_HOURS,
  defineIdempotentCreation,
} from "./idempotency";

const { withRollback, committed } = setupTestDatabase();

interface CreateCategoryInput {
  ownerId: string;
  idempotencyKey: string;
  name: string;
}

const BLANK = { code: "blank-name" } as const;
const RESERVED = { code: "reserved-name" } as const;

/** A creator over a real table; `reserved` is refused only after its row is written. */
function defineCategoryCreation(operation: string) {
  return defineIdempotentCreation({
    operation,
    prepare: (input: Readonly<CreateCategoryInput>) => {
      const name = input.name.trim();
      return name === "" ? err(BLANK) : ok({ name });
    },
    insert: async (tx, { ownerId, command }) => {
      const [row] = await tx
        .insert(categories)
        .values({
          userId: ownerId,
          kind: "expense",
          name: command.name,
          iconId: "generic",
        })
        .returning({ id: categories.id, name: categories.name });
      if (!row) {
        throw new Error("Category insert returned no row");
      }
      if (row.name === "reserved") {
        return err(RESERVED);
      }
      return ok(row);
    },
  });
}

const createCategory = defineCategoryCreation("categories.create");
const createOtherOperation = defineCategoryCreation("wallets.create");

async function listOwnerCategories(db: Database, ownerId: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, ownerId));
}

async function listOwnerReceiptKeys(db: Database, ownerId: string) {
  const rows = await db
    .select({ key: creationReceipts.key })
    .from(creationReceipts)
    .where(eq(creationReceipts.userId, ownerId));
  return rows.map((row) => row.key).sort();
}

/** Ages receipts past the replay window by rewriting `created_at`. */
async function expireReceipts(
  db: Database,
  { ownerId, key }: Readonly<{ ownerId: string; key?: string }>,
) {
  const owned = eq(creationReceipts.userId, ownerId);
  await db
    .update(creationReceipts)
    .set({
      createdAt: sql`now() - make_interval(hours => ${CREATION_REPLAY_WINDOW_HOURS + 1})`,
    })
    .where(key ? and(owned, eq(creationReceipts.key, key)) : owned);
}

describe("defineIdempotentCreation", () => {
  test("a sequential retry returns the original value after the resource changes or is removed", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const input = {
        ownerId: owner.id,
        idempotencyKey: "stable-result",
        name: "Travel",
      };
      const first = await createCategory(db, input);
      if (!first.ok) {
        throw new Error("Expected category creation to succeed");
      }

      await db
        .update(categories)
        .set({ name: "Trips" })
        .where(eq(categories.id, first.value.id));
      const afterUpdate = await createCategory(db, input);
      await db.delete(categories).where(eq(categories.id, first.value.id));
      const afterDelete = await createCategory(db, input);

      expect(first.value.name).toBe("Travel");
      expect(afterUpdate).toEqual(first);
      expect(afterDelete).toEqual(first);
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);
    });
  });

  test("a retry whose command differs only before preparation replays", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const first = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "prepared-equal",
        name: "Travel",
      });

      const retry = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "prepared-equal",
        name: "  Travel  ",
      });

      expect(retry).toEqual(first);
      expect(await listOwnerCategories(db, owner.id)).toHaveLength(1);
    });
  });

  test("a changed command conflicts without creating another resource", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "changed-command",
        name: "Travel",
      });

      const conflict = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "changed-command",
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
        createCategory(db, {
          ownerId: alice.id,
          idempotencyKey: "shared-key",
          name: "Alice expense",
        }),
        createOtherOperation(db, {
          ownerId: alice.id,
          idempotencyKey: "shared-key",
          name: "Alice other",
        }),
        createCategory(db, {
          ownerId: bob.id,
          idempotencyKey: "shared-key",
          name: "Bob expense",
        }),
      ]);

      expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
      expect(await listOwnerCategories(db, alice.id)).toHaveLength(2);
      expect(await listOwnerCategories(db, bob.id)).toHaveLength(1);
    });
  });

  test("concurrent retries commit one resource and return one value", async () => {
    const db = committed();
    const owner = await createTestUser(db);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        createCategory(db, {
          ownerId: owner.id,
          idempotencyKey: "concurrent-create",
          name: "Concurrent",
        }),
      ),
    );

    const successes = outcomes.filter((outcome) => outcome.ok);
    expect(successes).toHaveLength(5);
    expect(new Set(successes.map((outcome) => outcome.value.id)).size).toBe(1);
    expect(await listOwnerCategories(db, owner.id)).toHaveLength(1);
  });

  test("a rejection from prepare creates nothing and leaves the key unused", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const refused = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "prepare-rejected",
        name: "   ",
      });
      expect(refused).toEqual({ ok: false, error: BLANK });
      expect(await listOwnerReceiptKeys(db, owner.id)).toEqual([]);

      const corrected = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "prepare-rejected",
        name: "Corrected",
      });

      expect(corrected.ok && corrected.value.name).toBe("Corrected");
      expect(await listOwnerCategories(db, owner.id)).toEqual([
        expect.objectContaining({ name: "Corrected" }),
      ]);
    });
  });

  test("a rejection from insert rolls back its writes and leaves the key unused", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const refused = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "insert-rejected",
        name: "reserved",
      });
      expect(refused).toEqual({ ok: false, error: RESERVED });
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);
      expect(await listOwnerReceiptKeys(db, owner.id)).toEqual([]);

      const corrected = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "insert-rejected",
        name: "Corrected",
      });

      expect(corrected.ok && corrected.value.name).toBe("Corrected");
      expect(await listOwnerCategories(db, owner.id)).toEqual([
        expect.objectContaining({ name: "Corrected" }),
      ]);
    });
  });

  test("a receipt failure rolls back the created resource and leaves the key reusable", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const input = {
        ownerId: owner.id,
        idempotencyKey: "receipt-failure",
        name: "Atomic",
      };
      await db.execute(
        sql`alter table creation_receipts add constraint reject_receipt check (key <> 'receipt-failure')`,
      );

      await expect(createCategory(db, input)).rejects.toThrow();
      expect(await listOwnerCategories(db, owner.id)).toEqual([]);

      await db.execute(
        sql`alter table creation_receipts drop constraint reject_receipt`,
      );
      const retry = await createCategory(db, input);

      expect(retry.ok).toBe(true);
      expect(await listOwnerCategories(db, owner.id)).toHaveLength(1);
    });
  });

  test("a receipt inside its window still replays", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const input = {
        ownerId: owner.id,
        idempotencyKey: "inside-window",
        name: "Travel",
      };
      const first = await createCategory(db, input);
      await db
        .update(creationReceipts)
        .set({
          createdAt: sql`now() - make_interval(hours => ${CREATION_REPLAY_WINDOW_HOURS - 1})`,
        })
        .where(eq(creationReceipts.userId, owner.id));

      const retry = await createCategory(db, input);

      expect(retry).toEqual(first);
      expect(await listOwnerCategories(db, owner.id)).toHaveLength(1);
    });
  });

  test("an expired receipt is replaced by a new creation, even for a changed command", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const first = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "expired",
        name: "Travel",
      });
      await expireReceipts(db, { ownerId: owner.id });
      await db.delete(categories).where(eq(categories.userId, owner.id));

      const sameCommand = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "expired",
        name: "Travel",
      });
      await expireReceipts(db, { ownerId: owner.id });
      await db.delete(categories).where(eq(categories.userId, owner.id));
      const changedCommand = await createCategory(db, {
        ownerId: owner.id,
        idempotencyKey: "expired",
        name: "Trips",
      });

      if (!(first.ok && sameCommand.ok && changedCommand.ok)) {
        throw new Error("Expected every creation to succeed");
      }
      expect(
        new Set([first.value.id, sameCommand.value.id, changedCommand.value.id])
          .size,
      ).toBe(3);
      expect(await listOwnerCategories(db, owner.id)).toEqual([
        expect.objectContaining({ name: "Trips" }),
      ]);
      expect(await listOwnerReceiptKeys(db, owner.id)).toEqual(["expired"]);
    });
  });

  test("each creation purges that owner's expired receipts and keeps other owners'", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);
      for (const [ownerId, key] of [
        [alice.id, "alice-old-1"],
        [alice.id, "alice-old-2"],
        [alice.id, "alice-fresh"],
        [bob.id, "bob-old"],
      ] as const) {
        await createCategory(db, { ownerId, idempotencyKey: key, name: key });
      }
      await expireReceipts(db, { ownerId: alice.id, key: "alice-old-1" });
      await expireReceipts(db, { ownerId: alice.id, key: "alice-old-2" });
      await expireReceipts(db, { ownerId: bob.id });

      await createCategory(db, {
        ownerId: alice.id,
        idempotencyKey: "alice-new",
        name: "alice-new",
      });

      expect(await listOwnerReceiptKeys(db, alice.id)).toEqual([
        "alice-fresh",
        "alice-new",
      ]);
      expect(await listOwnerReceiptKeys(db, bob.id)).toEqual(["bob-old"]);
    });
  });
});
