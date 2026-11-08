import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { TransactionDetail } from "@bookkeeping/domain/transactions";
import { describe, expect, test } from "vitest";
import { createTagForTest } from "../testing/tag-fixture";
import type { OwnerFixture } from "../testing/transaction-suite-fixture";
import { setupOwner } from "../testing/transaction-suite-fixture";
import type { CreateTransactionInput } from "./transaction";
import {
  createTransaction,
  findTransaction,
  listTransactionChanges,
  listTransactionPage,
  updateTransaction,
} from "./transaction";

const { withRollback } = setupTestDatabase();

async function record(
  db: Database,
  input: CreateTransactionInput,
): Promise<TransactionDetail> {
  const created = await createTransaction(db, input);
  if (!created.ok) {
    throw new Error(
      `Expected the transaction to save, got ${created.error.code}`,
    );
  }
  return created.value.transaction;
}

function expenseInput(
  owner: Readonly<OwnerFixture>,
  overrides: Partial<CreateTransactionInput> = {},
): CreateTransactionInput {
  return {
    ownerId: owner.ownerId,
    idempotencyKey: randomUUID(),
    type: "expense",
    walletId: owner.cashId,
    categoryId: owner.childId,
    amount: 5_000n,
    transactionDate: "2026-09-02",
    note: "",
    ...overrides,
  };
}

describe("tagging on creation", () => {
  test("an expense saved with tags reports them by name, each once", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "7-Eleven",
      });
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "coffee",
      });

      const created = await createTransaction(
        db,
        expenseInput(owner, { tagIds: [coffee, shop, coffee] }),
      );

      if (!created.ok) {
        throw new Error(`Expected the expense to save, got ${created.error}`);
      }
      const expected = [
        { id: shop, name: "7-Eleven" },
        { id: coffee, name: "coffee" },
      ];
      expect(created.value.transaction.tags).toEqual(expected);
      const found = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: created.value.transaction.id,
      });
      expect(found?.tags).toEqual(expected);
    });
  });

  test("a transaction saved without tags carries none", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);

      const created = await createTransaction(db, expenseInput(owner));

      expect(created.ok && created.value.transaction.tags).toEqual([]);
    });
  });

  test("another owner's tag is not found and nothing is saved", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await setupOwner(db);
      const foreign = await createTagForTest(db, {
        ownerId: stranger.ownerId,
        name: "Coffee",
      });

      const created = await createTransaction(
        db,
        expenseInput(owner, { tagIds: [foreign] }),
      );

      expect(created).toEqual({
        ok: false,
        error: { field: "tagIds", code: "tag-not-found" },
      });
    });
  });
});

describe("tagging on correction", () => {
  test("changing only the tags is a correction recorded in Change history", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Shop",
      });
      const expense = await record(
        db,
        expenseInput(owner, { tagIds: [coffee] }),
      );
      const edit = {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
        note: "",
      };

      const updated = await updateTransaction(db, { ...edit, tagIds: [shop] });
      const cleared = await updateTransaction(db, { ...edit, tagIds: [] });

      expect(updated.ok && updated.value.tags).toEqual([
        { id: shop, name: "Shop" },
      ]);
      expect(cleared.ok && cleared.value.tags).toEqual([]);
      const changes = await listTransactionChanges(db, {
        ownerId: owner.ownerId,
        id: expense.id,
      });
      expect(
        changes.map((change) => [change.before.tagIds, change.after?.tagIds]),
      ).toEqual([
        [[coffee], [shop]],
        [[shop], undefined],
      ]);
    });
  });

  test("repeating the same tags in another order changes nothing and records nothing", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Shop",
      });
      const expense = await record(
        db,
        expenseInput(owner, { tagIds: [coffee, shop] }),
      );

      await updateTransaction(db, {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
        note: "",
        tagIds: [shop, coffee],
      });

      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
    });
  });
});

describe("refunds and transfers", () => {
  test("a refund reports its expense's current tags", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Shop",
      });
      const expense = await record(
        db,
        expenseInput(owner, { tagIds: [coffee] }),
      );
      const refund = await record(db, {
        ...expenseInput(owner),
        type: "refund",
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 1_000n,
      });
      expect(refund.tags).toEqual([{ id: coffee, name: "Coffee" }]);

      await updateTransaction(db, {
        ownerId: owner.ownerId,
        id: expense.id,
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
        note: "",
        tagIds: [shop],
      });

      const found = await findTransaction(db, {
        ownerId: owner.ownerId,
        id: refund.id,
      });
      expect(found?.tags).toEqual([{ id: shop, name: "Shop" }]);
    });
  });

  test("a refund or transfer given tags of its own is refused", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const expense = await record(db, expenseInput(owner));

      const refund = await createTransaction(db, {
        ...expenseInput(owner, { tagIds: [coffee] }),
        type: "refund",
        categoryId: null,
        refundOfTransactionId: expense.id,
        amount: 1_000n,
      });
      const transfer = await createTransaction(db, {
        ...expenseInput(owner, { tagIds: [coffee] }),
        type: "transfer",
        categoryId: null,
        destinationWalletId: owner.bankId,
      });

      expect(refund).toEqual({
        ok: false,
        error: { field: "type", code: "invalid-refund" },
      });
      expect(transfer).toEqual({
        ok: false,
        error: { field: "type", code: "invalid-transfer" },
      });
    });
  });
});

describe("filtering by tag", () => {
  test("any of the chosen tags matches, refunds follow their expense, and pages continue", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const coffee = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Coffee",
      });
      const shop = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Shop",
      });
      const game = await createTagForTest(db, {
        ownerId: owner.ownerId,
        name: "Game",
      });
      const latte = await record(
        db,
        expenseInput(owner, {
          tagIds: [coffee],
          transactionDate: "2026-09-02",
        }),
      );
      const snacks = await record(
        db,
        expenseInput(owner, {
          tagIds: [shop, coffee],
          transactionDate: "2026-09-03",
        }),
      );
      await record(
        db,
        expenseInput(owner, { tagIds: [game], transactionDate: "2026-09-04" }),
      );
      await record(db, expenseInput(owner, { transactionDate: "2026-09-05" }));
      const refund = await record(db, {
        ...expenseInput(owner, { transactionDate: "2026-09-06" }),
        type: "refund",
        categoryId: null,
        refundOfTransactionId: latte.id,
        amount: 1_000n,
      });

      const first = await listTransactionPage(db, {
        ownerId: owner.ownerId,
        tagIds: [coffee, shop],
        limit: 2,
      });
      const second = first.nextPosition
        ? await listTransactionPage(db, {
            ownerId: owner.ownerId,
            tagIds: [coffee, shop],
            limit: 2,
            after: first.nextPosition,
          })
        : undefined;

      expect(
        [...first.items, ...(second?.items ?? [])].map((item) => item.id),
      ).toEqual([refund.id, snacks.id, latte.id]);
      expect(second?.nextPosition).toBeNull();
    });
  });

  test("another owner's tag matches nothing", async () => {
    await withRollback(async (db) => {
      const owner = await setupOwner(db);
      const stranger = await setupOwner(db);
      const foreign = await createTagForTest(db, {
        ownerId: stranger.ownerId,
        name: "Coffee",
      });
      await record(db, {
        ...expenseInput(stranger),
        tagIds: [foreign],
      });
      await record(db, expenseInput(owner));

      const page = await listTransactionPage(db, {
        ownerId: owner.ownerId,
        tagIds: [foreign],
        limit: 10,
      });

      expect(page.items).toEqual([]);
    });
  });
});
