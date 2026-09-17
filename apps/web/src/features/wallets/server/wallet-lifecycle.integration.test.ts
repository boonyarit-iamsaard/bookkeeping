import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { listWallets } from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { listCategories } from "@/features/categories/server/category";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { createWallet } from "@/features/wallets/server/wallet";
import {
  correctWalletOpening,
  deleteWallet,
  setWalletArchived,
} from "@/features/wallets/server/wallet-lifecycle";

const { withRollback, committed } = setupTestDatabase();
async function fixture(db: Database) {
  const owner = await createTestUser(db);
  await initializeDefaultCategories(db, owner.id);
  const category = (await listCategories(db, owner.id)).find(
    (item) => item.kind === "expense",
  );
  if (!category) {
    throw new Error("Missing category");
  }
  const input = {
    ownerId: owner.id,
    name: "Cash",
    type: "cash",
    openingAmount: 10000n,
    openingDate: "2026-09-01",
  } as const;
  const wallet = await createWallet(db, input);
  const other = await createWallet(db, { ...input, name: "Bank" });
  const movement = {
    ownerId: owner.id,
    submissionKey: crypto.randomUUID(),
    type: "expense",
    walletId: wallet.id,
    categoryId: category.id,
    amount: 100n,
    transactionDate: "2026-09-02",
    note: "",
  } as const;
  return {
    owner,
    wallet,
    other,
    movement,
    owned: { ownerId: owner.id, id: wallet.id },
  };
}
describe("wallet lifecycle", () => {
  test("exact opening corrections preserve recording times and atomically retain history", async () => {
    await withRollback(async (db) => {
      const { owned, movement } = await fixture(db);
      const created = await createTransaction(db, movement);
      if (!created.ok) {
        throw new Error("Create failed");
      }
      expect(
        await correctWalletOpening(db, {
          ...owned,
          openingAmount: -99999999999999999n,
          openingDate: "2026-09-02",
        }),
      ).toEqual({ ok: true, value: { id: owned.id } });
      const listed = await listWallets(db, { ownerId: owned.ownerId });
      expect(listed.find((w) => w.id === owned.id)?.balance).toBe(
        -100000000000000099n,
      );
      expect(
        (
          await getTransaction(db, {
            ownerId: owned.ownerId,
            id: created.value.transaction.id,
          })
        )?.recordedAt,
      ).toEqual(created.value.transaction.recordedAt);
      const changes = await db
        .select()
        .from(walletChanges)
        .where(eq(walletChanges.walletId, owned.id));
      expect(changes).toHaveLength(1);
      expect(changes[0]?.before.openingAmount).toBe("10000");
      expect(changes[0]?.after.openingAmount).toBe("-99999999999999999");
      expect(
        await correctWalletOpening(db, {
          ...owned,
          openingAmount: 1n,
          openingDate: "2026-09-03",
        }),
      ).toEqual({ ok: false, error: "movement-before-opening" });
      expect(
        await correctWalletOpening(db, {
          ...owned,
          openingAmount: 1n,
          openingDate: "invalid",
        }),
      ).toEqual({ ok: false, error: "invalid-opening" });
    });
  });
  test("both transfer wallets guard opening dates; deleted movements retain guards", async () => {
    await withRollback(async (db) => {
      const { owned, movement, other } = await fixture(db);
      const created = await createTransaction(db, {
        ...movement,
        type: "transfer",
        categoryId: null,
        currency: "THB",
        destinationWalletId: other.id,
      });
      if (!created.ok) {
        throw new Error("Transfer failed");
      }
      for (const id of [owned.id, other.id]) {
        expect(
          await correctWalletOpening(db, {
            ...owned,
            id,
            openingAmount: 0n,
            openingDate: "2026-09-03",
          }),
        ).toEqual({ ok: false, error: "movement-before-opening" });
      }
      await deleteTransaction(db, {
        ownerId: owned.ownerId,
        id: created.value.transaction.id,
      });
      expect(await deleteWallet(db, owned)).toEqual({
        ok: false,
        error: "history-remains",
      });
      expect(
        await correctWalletOpening(db, {
          ...owned,
          openingAmount: 0n,
          openingDate: "2026-09-03",
        }),
      ).toEqual({ ok: false, error: "movement-before-opening" });
    });
  });
  test("archive retains current/historical totals, permits retained edits, rejects new archived wallets, and restores eligibility", async () => {
    await withRollback(async (db) => {
      const { owned, movement, other } = await fixture(db);
      const created = await createTransaction(db, movement);
      if (!created.ok) {
        throw new Error("Create failed");
      }
      await setWalletArchived(db, { ...owned, archived: true });
      const current = await listWallets(db, { ownerId: owned.ownerId });
      expect(current.reduce((sum, w) => sum + w.balance, 0n)).toBe(19900n);
      expect(
        (
          await listWallets(db, { ownerId: owned.ownerId, asOf: "2026-09-01" })
        ).reduce((sum, w) => sum + w.balance, 0n),
      ).toBe(20000n);
      expect(
        await createTransaction(db, {
          ...movement,
          submissionKey: crypto.randomUUID(),
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owned.id },
      });
      expect(
        (
          await updateTransaction(db, {
            ...movement,
            id: created.value.transaction.id,
            amount: 200n,
          })
        ).ok,
      ).toBe(true);
      await setWalletArchived(db, { ...owned, id: other.id, archived: true });
      expect(
        await updateTransaction(db, {
          ...movement,
          id: created.value.transaction.id,
          walletId: other.id,
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: other.id },
      });
      await setWalletArchived(db, { ...owned, archived: false });
      expect(
        (
          await createTransaction(db, {
            ...movement,
            submissionKey: crypto.randomUUID(),
          })
        ).ok,
      ).toBe(true);
    });
  });
  test("all operations isolate ownership; unused wallets can delete but snapshot and wallet history cannot", async () => {
    await withRollback(async (db) => {
      const { owned, movement, other } = await fixture(db);
      const stranger = await createTestUser(db);
      const foreign = { ...owned, ownerId: stranger.id };
      expect(await deleteWallet(db, foreign)).toEqual({
        ok: false,
        error: "wallet-not-found",
      });
      expect(
        await setWalletArchived(db, { ...foreign, archived: true }),
      ).toEqual({ ok: false, error: "wallet-not-found" });
      expect(
        await correctWalletOpening(db, {
          ...foreign,
          openingAmount: 0n,
          openingDate: "2026-09-01",
        }),
      ).toEqual({ ok: false, error: "wallet-not-found" });
      const created = await createTransaction(db, movement);
      if (!created.ok) {
        throw new Error("Create failed");
      }
      await updateTransaction(db, {
        ...movement,
        id: created.value.transaction.id,
        walletId: other.id,
      });
      expect(await deleteWallet(db, owned)).toEqual({
        ok: false,
        error: "history-remains",
      });
      const unused = await createWallet(db, {
        ownerId: owned.ownerId,
        name: "Unused",
        type: "cash",
        openingAmount: 1200n,
        openingDate: "2026-09-01",
      });
      expect((await deleteWallet(db, { ...owned, id: unused.id })).ok).toBe(
        true,
      );
      await setWalletArchived(db, { ...owned, archived: true });
      expect(await deleteWallet(db, owned)).toEqual({
        ok: false,
        error: "history-remains",
      });
    });
  });
  test("a create waiting behind archive rechecks eligibility after its lock is released", async () => {
    const db = committed();
    const { owned, movement } = await fixture(db);
    let release = () => {};
    let locked = () => {};
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const archive = db.transaction(async (tx) => {
      await tx
        .select()
        .from(wallets)
        .where(and(eq(wallets.id, owned.id), eq(wallets.userId, owned.ownerId)))
        .for("update");
      locked();
      await gate;
      await setWalletArchived(tx, { ...owned, archived: true });
    });
    await ready;
    const create = createTransaction(db, movement);
    release();
    await archive;
    expect(await create).toEqual({
      ok: false,
      error: { code: "wallet-archived", walletId: owned.id },
    });
    const [{ count } = { count: "0" }] = await db
      .select({ count: sql<string>`count(*)` })
      .from(walletChanges)
      .where(eq(walletChanges.walletId, owned.id));
    expect(Number(count)).toBe(1);
  });
});
