import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import { findTransaction } from "@bookkeeping/application/transactions";
import {
  deleteWallet,
  listWallets,
  replaceWalletOpening,
  setWalletArchived,
} from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/features/transactions/server/transaction";
import { openWallet } from "@/testing/wallet-fixture";

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
  const wallet = await openWallet(db, input);
  const other = await openWallet(db, { ...input, name: "Bank" });
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
  test("an opening replacement through the application keeps a recorded movement and its recording time", async () => {
    await withRollback(async (db) => {
      const { owned, movement } = await fixture(db);
      const created = await createTransaction(db, movement);
      if (!created.ok) {
        throw new Error("Create failed");
      }
      expect(
        (
          await replaceWalletOpening(db, {
            ...owned,
            openingAmount: -99999999999999999n,
            openingDate: "2026-09-02",
          })
        ).ok,
      ).toBe(true);
      const listed = await listWallets(db, { ownerId: owned.ownerId });
      expect(listed.find((w) => w.id === owned.id)?.balance).toBe(
        -100000000000000099n,
      );
      expect(
        (
          await findTransaction(db, {
            ownerId: owned.ownerId,
            id: created.value.transaction.id,
          })
        )?.recordedAt,
      ).toEqual(created.value.transaction.recordedAt);
    });
  });
  test("a deleted transfer still guards deletion and opening dates for both wallets", async () => {
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
      await deleteTransaction(db, {
        ownerId: owned.ownerId,
        id: created.value.transaction.id,
      });
      for (const id of [owned.id, other.id]) {
        expect(await deleteWallet(db, { ...owned, id })).toEqual({
          ok: false,
          error: { code: "history-remains" },
        });
        expect(
          await replaceWalletOpening(db, {
            ...owned,
            id,
            openingAmount: 0n,
            openingDate: "2026-09-03",
          }),
        ).toEqual({ ok: false, error: { code: "movement-before-opening" } });
      }
    });
  });
  test("archive through the application retains current/historical totals, permits retained edits, rejects new archived wallets, and restores eligibility", async () => {
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
        error: { code: "wallet-not-found" },
      });
      expect(
        await setWalletArchived(db, { ...foreign, archived: true }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
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
        error: { code: "history-remains" },
      });
      const unused = await openWallet(db, {
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
        error: { code: "history-remains" },
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
