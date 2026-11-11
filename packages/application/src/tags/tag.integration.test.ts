import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { createTagForTest } from "../testing/tag-fixture";
import type { OwnerFixture } from "../testing/transaction-suite-fixture";
import { setupOwner, softDelete } from "../testing/transaction-suite-fixture";
import {
  createTransaction,
  findTransaction,
  listTransactionChanges,
} from "../transactions/transaction";
import { createTag, deleteTag, listTags, renameTag } from "./tag";

const { withRollback, committed } = setupTestDatabase();

/** Records a groceries expense carrying these tags and returns its id. */
interface TaggedExpense {
  owner: OwnerFixture;
  tagIds: readonly string[];
}

async function recordTagged(
  db: Database,
  { owner, tagIds }: Readonly<TaggedExpense>,
): Promise<string> {
  const created = await createTransaction(db, {
    ownerId: owner.ownerId,
    idempotencyKey: randomUUID(),
    type: "expense",
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 5_000n,
    transactionDate: "2026-09-02",
    note: "",
    tagIds,
  });
  if (!created.ok) {
    throw new Error(`Expected the expense to save, got ${created.error.code}`);
  }
  return created.value.id;
}

describe("createTag", () => {
  test("a new tag is trimmed, listed for its owner, and unused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);

      const created = await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey: randomUUID(),
        name: "  7-Eleven ",
      });

      if (!created.ok) {
        throw new Error(`Expected the tag to save, got ${created.error.code}`);
      }
      expect(created.value).toEqual({
        id: expect.any(String),
        name: "7-Eleven",
      });
      expect(await listTags(db, owner.ownerId)).toEqual([
        {
          id: created.value.id,
          name: "7-Eleven",
          transactionCount: 0,
          lastUsedAt: null,
        },
      ]);
    });
  });

  test("a name already used by the owner, ignoring case and whitespace, is refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey: randomUUID(),
        name: "Coffee",
      });

      const duplicate = await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey: randomUUID(),
        name: " coffee",
      });

      expect(duplicate).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "duplicate-name", field: "name" }],
        },
      });
    });
  });

  test("another owner may use the same name and never sees the first owner's tags", async () => {
    await withRollback(async (db) => {
      const first = await setupOwner(db);
      const second = await setupOwner(db);
      await createTag(db, {
        ownerId: first.ownerId,
        idempotencyKey: randomUUID(),
        name: "Coffee",
      });

      const created = await createTag(db, {
        ownerId: second.ownerId,
        idempotencyKey: randomUUID(),
        name: "Coffee",
      });

      expect(created.ok).toBe(true);
      expect(await listTags(db, second.ownerId)).toHaveLength(1);
    });
  });

  test("a blank or overlong name is refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);

      const blank = await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey: randomUUID(),
        name: "   ",
      });
      const overlong = await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey: randomUUID(),
        name: "x".repeat(41),
      });

      expect(blank).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "blank-name", field: "name" }],
        },
      });
      expect(overlong).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "name-too-long", field: "name" }],
        },
      });
    });
  });

  test("repeating a key replays the original tag", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const idempotencyKey = randomUUID();
      const input = { ownerId: owner.ownerId, idempotencyKey, name: "Coffee" };

      const first = await createTag(db, input);
      const replay = await createTag(db, input);

      expect(first.ok).toBe(true);
      expect(replay).toEqual(first);
      expect(await listTags(db, owner.ownerId)).toHaveLength(1);
    });
  });

  test("a changed name under a used key conflicts without another tag", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const idempotencyKey = randomUUID();

      await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey,
        name: "Coffee",
      });
      const conflict = await createTag(db, {
        ownerId: owner.ownerId,
        idempotencyKey,
        name: "Tea",
      });

      expect(conflict).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      expect(await listTags(db, owner.ownerId)).toHaveLength(1);
    });
  });
});

describe("listTags", () => {
  test("suggestions put the most recently used first, then the most used, then unused by name", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const tag = (name: string) =>
        createTagForTest(db, { ownerId: owner.ownerId, name });
      const often = await tag("Often");
      const latest = await tag("Latest");
      await tag("zebra");
      await tag("Apple");
      const dropped = await tag("Dropped");
      await recordTagged(db, { owner, tagIds: [often] });
      await recordTagged(db, { owner, tagIds: [often] });
      await softDelete(
        db,
        await recordTagged(db, { owner, tagIds: [dropped] }),
      );
      await recordTagged(db, { owner, tagIds: [latest] });

      const listed = await listTags(db, owner.ownerId);

      expect(
        listed.map(({ name, transactionCount, lastUsedAt }) => [
          name,
          transactionCount,
          lastUsedAt === null ? null : "used",
        ]),
      ).toEqual([
        ["Latest", 1, "used"],
        ["Often", 2, "used"],
        ["Apple", 0, null],
        ["Dropped", 0, null],
        ["zebra", 0, null],
      ]);
    });
  });
});

describe("renameTag", () => {
  test("a rename shows on every transaction carrying the tag without writing history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "7-11",
      });
      const expenseId = await recordTagged(db, { owner, tagIds: [shop] });

      const renamed = await renameTag(db, {
        ownerId: owner.ownerId,
        id: shop,
        name: " 7-Eleven ",
      });

      expect(renamed).toEqual({
        ok: true,
        value: { id: shop, name: "7-Eleven" },
      });
      const found = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: expenseId,
      });
      expect(found?.tags).toEqual([{ id: shop, name: "7-Eleven" }]);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expenseId,
        }),
      ).toEqual([]);
    });
  });

  test("renaming to another tag's name merges the two into that tag, keeping every transaction", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const drifted = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "7-11",
      });
      const kept = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "7-Eleven",
      });
      const onlyDrifted = await recordTagged(db, { owner, tagIds: [drifted] });
      const both = await recordTagged(db, { owner, tagIds: [drifted, kept] });

      const merged = await renameTag(db, {
        ownerId: owner.ownerId,
        id: drifted,
        name: "7-eleven",
      });

      expect(merged).toEqual({
        ok: true,
        value: { id: kept, name: "7-eleven" },
      });
      for (const id of [onlyDrifted, both]) {
        const found = await findTransaction(db, { ownerId: owner.ownerId, id });
        expect(found?.tags).toEqual([{ id: kept, name: "7-eleven" }]);
        expect(
          await listTransactionChanges(db, { ownerId: owner.ownerId, id }),
        ).toEqual([]);
      }
      expect(await listTags(db, owner.ownerId)).toEqual([
        expect.objectContaining({ id: kept, transactionCount: 2 }),
      ]);
    });
  });

  test("a merge matches names the way their uniqueness does, beyond plain ASCII", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const kept = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Äpfel",
      });
      const drifted = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Apples",
      });

      const merged = await renameTag(db, {
        ownerId: owner.ownerId,
        id: drifted,
        name: "ÄPFEL",
      });

      expect(merged).toEqual({ ok: true, value: { id: kept, name: "ÄPFEL" } });
    });
  });

  test("changing only the case of a tag's own name renames it", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "coffee",
      });

      const renamed = await renameTag(db, {
        ownerId: owner.ownerId,
        id: coffee,
        name: "Coffee",
      });

      expect(renamed).toEqual({
        ok: true,
        value: { id: coffee, name: "Coffee" },
      });
    });
  });

  test("two tags swapping names concurrently merge instead of deadlocking", async () => {
    const db = committed();
    const owner = await setupOwner(db);
    const rounds = 3;

    for (let round = 0; round < rounds; round += 1) {
      const first = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: `first-${round}`,
      });
      const second = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: `second-${round}`,
      });

      const outcomes = await Promise.all([
        renameTag(db, {
          ownerId: owner.ownerId,
          id: first,
          name: `Second-${round}`,
        }),
        renameTag(db, {
          ownerId: owner.ownerId,
          id: second,
          name: `First-${round}`,
        }),
      ]);

      expect(outcomes).toEqual([
        expect.objectContaining({ ok: true }),
        expect.objectContaining({ ok: true }),
      ]);
    }
    expect(await listTags(db, owner.ownerId)).toHaveLength(rounds);
  });

  test("another owner's tag is not found, and a blank name is refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await setupOwner(db);
      const foreign = await createTagForTest(db, {
        ownerId: stranger.ownerId,
        name: "Coffee",
      });
      const own = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Tea",
      });

      expect(
        await renameTag(db, {
          ownerId: owner.ownerId,
          id: foreign,
          name: "Mine",
        }),
      ).toEqual({ ok: false, error: { code: "not-found" } });
      expect(
        await renameTag(db, { ownerId: owner.ownerId, id: own, name: " " }),
      ).toEqual({
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "blank-name", field: "name" }],
        },
      });
    });
  });
});

describe("deleteTag", () => {
  test("deleting a tag takes it off every transaction and keeps the transactions without history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const expenseId = await recordTagged(db, { owner, tagIds: [coffee] });

      const deleted = await deleteTag(db, {
        ownerId: owner.ownerId,
        id: coffee,
      });

      expect(deleted).toEqual({ ok: true, value: { id: coffee } });
      const found = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: expenseId,
      });
      expect(found?.tags).toEqual([]);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expenseId,
        }),
      ).toEqual([]);
      expect(await listTags(db, owner.ownerId)).toEqual([]);
    });
  });

  test("another owner's tag is not found and stays", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await setupOwner(db);
      const foreign = await createTagForTest(db, {
        ownerId: stranger.ownerId,
        name: "Coffee",
      });

      expect(
        await deleteTag(db, { ownerId: owner.ownerId, id: foreign }),
      ).toEqual({ ok: false, error: { code: "not-found" } });
      expect(await listTags(db, stranger.ownerId)).toHaveLength(1);
    });
  });
});
