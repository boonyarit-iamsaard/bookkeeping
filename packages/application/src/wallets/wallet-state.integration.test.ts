import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { walletChanges } from "@bookkeeping/database/wallets";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
} from "../categories/category";
import { createWallet, findWallet } from "./wallet";
import { changeWalletState } from "./wallet-state";

const { withRollback } = setupTestDatabase();

async function openWallet(
  db: Database,
  {
    type = "cash",
    openingAmount = 10_000n,
  }: Readonly<{
    type?: WalletType;
    openingAmount?: bigint;
  }> = {},
) {
  const owner = await createTestUser(db);
  const created = await createWallet(db, {
    ownerId: owner.id,
    idempotencyKey: "wallet",
    name: "Wallet",
    type,
    savings: false,
    openingAmount,
    openingDate: "2026-09-01",
  });
  if (!created.ok) {
    throw new Error("Wallet creation failed");
  }
  return { owner, wallet: created.value.wallet };
}

async function listChanges(db: Database, walletId: string) {
  return db
    .select()
    .from(walletChanges)
    .where(eq(walletChanges.walletId, walletId))
    .orderBy(asc(walletChanges.changedAt), asc(walletChanges.id));
}

const snapshot = {
  openingAmount: "10000",
  openingDate: "2026-09-01",
  archivedAt: null,
  savings: false,
};

describe("changeWalletState", () => {
  test("archives, records the change, and returns the updated wallet", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const archived = await changeWalletState(db, {
        ownerId: owner.id,
        id: wallet.id,
        archived: true,
      });

      expect(archived).toEqual({
        ok: true,
        value: { ...wallet, archivedAt: expect.any(Date) },
      });
      expect(
        await findWallet(db, { ownerId: owner.id, id: wallet.id }),
      ).toEqual(archived.ok ? archived.value : null);
      expect(await listChanges(db, wallet.id)).toEqual([
        expect.objectContaining({
          userId: owner.id,
          action: "archive",
          before: snapshot,
          after: { ...snapshot, archivedAt: expect.any(String) },
        }),
      ]);
    });
  });

  test("restores by clearing the archived instant and records the change", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const ref = { ownerId: owner.id, id: wallet.id };
      const archived = await changeWalletState(db, { ...ref, archived: true });
      if (!archived.ok) {
        throw new Error("Archive failed");
      }

      expect(await changeWalletState(db, { ...ref, archived: false })).toEqual({
        ok: true,
        value: wallet,
      });
      expect(await listChanges(db, wallet.id)).toEqual([
        expect.objectContaining({ action: "archive" }),
        expect.objectContaining({
          action: "unarchive",
          before: { ...snapshot, archivedAt: expect.any(String) },
          after: snapshot,
        }),
      ]);
    });
  });

  test("repeating the archived state changes nothing and records no history", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const input = { ownerId: owner.id, id: wallet.id, archived: true };
      const first = await changeWalletState(db, input);
      expect(await changeWalletState(db, input)).toEqual(first);
      expect(await listChanges(db, wallet.id)).toHaveLength(1);
    });
  });

  test.each(WALLET_TYPES)(
    "marking and unmarking a %s wallet leaves its type, balance, opening and transactions unchanged",
    async (type) => {
      await withRollback(async (db) => {
        const { owner, wallet } = await openWallet(db, { type });
        await initializeDefaultCategories(db, owner.id);
        const category = (await listCategories(db, owner.id)).find(
          (item) => item.kind === "income",
        );
        if (!category) {
          throw new Error("Missing income category");
        }
        await db.insert(transactions).values({
          userId: owner.id,
          type: "income",
          walletId: wallet.id,
          categoryId: category.id,
          amount: 123n,
          transactionDate: "2026-09-02",
        });
        const ref = { ownerId: owner.id, id: wallet.id };
        const original = await findWallet(db, ref);
        if (!original) {
          throw new Error("Wallet not found");
        }
        const movements = await db
          .select()
          .from(transactions)
          .where(eq(transactions.walletId, wallet.id));

        expect(await changeWalletState(db, { ...ref, savings: true })).toEqual({
          ok: true,
          value: { ...original, savings: true },
        });
        expect(await findWallet(db, ref)).toEqual({
          ...original,
          savings: true,
        });
        expect(await changeWalletState(db, { ...ref, savings: false })).toEqual(
          {
            ok: true,
            value: original,
          },
        );
        expect(await findWallet(db, ref)).toEqual(original);
        expect(
          await db
            .select()
            .from(transactions)
            .where(eq(transactions.walletId, wallet.id)),
        ).toEqual(movements);
        expect(await listChanges(db, wallet.id)).toEqual([
          expect.objectContaining({
            userId: owner.id,
            action: "mark-savings",
            before: snapshot,
            after: { ...snapshot, savings: true },
          }),
          expect.objectContaining({
            userId: owner.id,
            action: "unmark-savings",
            before: { ...snapshot, savings: true },
            after: snapshot,
          }),
        ]);
      });
    },
  );

  test("repeating either savings state records no history", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const ref = { ownerId: owner.id, id: wallet.id };
      expect(await changeWalletState(db, { ...ref, savings: false })).toEqual({
        ok: true,
        value: wallet,
      });
      expect(await listChanges(db, wallet.id)).toEqual([]);
      const marked = await changeWalletState(db, { ...ref, savings: true });
      expect(await changeWalletState(db, { ...ref, savings: true })).toEqual(
        marked,
      );
      expect(await listChanges(db, wallet.id)).toHaveLength(1);
      const unmarked = await changeWalletState(db, { ...ref, savings: false });
      expect(await changeWalletState(db, { ...ref, savings: false })).toEqual(
        unmarked,
      );
      expect(await listChanges(db, wallet.id)).toHaveLength(2);
    });
  });

  test("changing archived and savings together records one row per changed field", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const ref = { ownerId: owner.id, id: wallet.id };
      const changed = await changeWalletState(db, {
        ...ref,
        archived: true,
        savings: true,
      });
      expect(changed).toEqual({
        ok: true,
        value: { ...wallet, archivedAt: expect.any(Date), savings: true },
      });
      const archivedSnapshot = { ...snapshot, archivedAt: expect.any(String) };
      const markedSnapshot = { ...archivedSnapshot, savings: true };
      expect(await listChanges(db, wallet.id)).toEqual([
        expect.objectContaining({
          action: "archive",
          before: snapshot,
          after: archivedSnapshot,
        }),
        expect.objectContaining({
          action: "mark-savings",
          before: archivedSnapshot,
          after: markedSnapshot,
        }),
      ]);
      expect(
        await changeWalletState(db, {
          ...ref,
          archived: true,
          savings: true,
        }),
      ).toEqual(changed);
      expect(await listChanges(db, wallet.id)).toHaveLength(2);
      expect(await changeWalletState(db, { ...ref, archived: false })).toEqual({
        ok: true,
        value: { ...wallet, savings: true },
      });
      expect(await listChanges(db, wallet.id)).toEqual([
        expect.objectContaining({ action: "archive" }),
        expect.objectContaining({ action: "mark-savings" }),
        expect.objectContaining({
          action: "unarchive",
          before: markedSnapshot,
          after: { ...snapshot, savings: true },
        }),
      ]);
    });
  });

  test("marking an archived negative wallet keeps its balance and archive instant", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db, { openingAmount: -123n });
      const ref = { ownerId: owner.id, id: wallet.id };
      const archived = await changeWalletState(db, { ...ref, archived: true });
      if (!archived.ok) {
        throw new Error("Archive failed");
      }
      expect(await changeWalletState(db, { ...ref, savings: true })).toEqual({
        ok: true,
        value: { ...archived.value, savings: true },
      });
    });
  });

  test("another owner's, an unknown, and a malformed wallet id are not found alike", async () => {
    await withRollback(async (db) => {
      const { owner, wallet } = await openWallet(db);
      const stranger = await createTestUser(db);
      for (const attempt of [
        { ownerId: stranger.id, id: wallet.id },
        { ownerId: owner.id, id: "01999999-0000-7000-8000-000000000000" },
        { ownerId: owner.id, id: "not-a-uuid" },
      ]) {
        for (const state of [{ archived: true }, { savings: true }]) {
          expect(await changeWalletState(db, { ...attempt, ...state })).toEqual(
            {
              ok: false,
              error: { code: "wallet-not-found" },
            },
          );
        }
      }
      expect(
        await findWallet(db, { ownerId: owner.id, id: wallet.id }),
      ).toEqual(wallet);
      expect(await listChanges(db, wallet.id)).toEqual([]);
    });
  });
});
