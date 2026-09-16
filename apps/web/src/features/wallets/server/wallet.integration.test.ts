import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { describe, expect, test, vi } from "vitest";
import { createWallet, listWallets } from "@/features/wallets/server/wallet";

const { withRollback } = setupTestDatabase();

describe("wallet operations", () => {
  test("a created wallet is listed with its opening balance as the balance", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      await createWallet(db, {
        ownerId: owner.id,
        name: "Kasikorn savings",
        type: "bank_account",
        openingAmount: 1_200_000n,
        openingDate: "2026-09-01",
      });

      expect(await listWallets(db, { ownerId: owner.id })).toEqual([
        expect.objectContaining({
          name: "Kasikorn savings",
          type: "bank_account",
          currency: "THB",
          openingAmount: 1_200_000n,
          openingDate: "2026-09-01",
          balance: 1_200_000n,
        }),
      ]);
    });
  });

  test("future openings do not contribute to current balances", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-13T10:00:00Z"));
    try {
      await withRollback(async (db) => {
        const owner = await createTestUser(db);
        await createWallet(db, {
          ownerId: owner.id,
          name: "Future",
          type: "cash",
          openingAmount: 12000n,
          openingDate: "2026-09-14",
        });
        expect(await listWallets(db, { ownerId: owner.id })).toEqual([
          expect.objectContaining({ openingAmount: 12000n, balance: 0n }),
        ]);
        vi.setSystemTime(new Date("2026-09-13T17:00:00Z"));
        expect(await listWallets(db, { ownerId: owner.id })).toEqual([
          expect.objectContaining({ balance: 12000n }),
        ]);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  test("all three wallet types persist", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      for (const type of ["cash", "bank_account", "e_wallet"] as const) {
        await createWallet(db, {
          ownerId: owner.id,
          name: type,
          type,
          openingAmount: 0n,
          openingDate: "2026-09-01",
        });
      }

      const types = (await listWallets(db, { ownerId: owner.id })).map(
        (w) => w.type,
      );
      expect(types).toEqual(["cash", "bank_account", "e_wallet"]);
    });
  });

  test("openings beyond signed 32-bit satang and negative openings are exact", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await createWallet(db, {
        ownerId: owner.id,
        name: "Big",
        type: "bank_account",
        openingAmount: 9_999_999_999n,
        openingDate: "2026-09-01",
      });
      await createWallet(db, {
        ownerId: owner.id,
        name: "Overdrawn",
        type: "e_wallet",
        openingAmount: -12_050n,
        openingDate: "2026-09-01",
      });

      const balances = (await listWallets(db, { ownerId: owner.id })).map(
        (w) => w.balance,
      );
      expect(balances).toEqual([9_999_999_999n, -12_050n]);
    });
  });

  test("another user's wallets never appear in a listing", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);
      await createWallet(db, {
        ownerId: alice.id,
        name: "Alice cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });

      expect(await listWallets(db, { ownerId: bob.id })).toEqual([]);
    });
  });

  test("the total across wallets is exact beyond 32-bit satang", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      for (const amount of [9_999_999_999n, 9_999_999_999n, -1n]) {
        await createWallet(db, {
          ownerId: owner.id,
          name: "Wallet",
          type: "cash",
          openingAmount: amount,
          openingDate: "2026-09-01",
        });
      }

      const total = (await listWallets(db, { ownerId: owner.id })).reduce(
        (sum, w) => sum + w.balance,
        0n,
      );
      expect(total).toBe(19_999_999_997n);
    });
  });
});
