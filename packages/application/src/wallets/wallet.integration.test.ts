import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { describe, expect, test, vi } from "vitest";
import { findWallet, listWallets } from "./wallet";

const { withRollback } = setupTestDatabase();

interface WalletFixture {
  ownerId: string;
  name: string;
  type: WalletType;
  openingAmount: bigint;
  openingDate: CalendarDate;
}

/** Persists a wallet row directly; creation moves here with its own ticket. */
async function insertWallet(db: Database, fixture: Readonly<WalletFixture>) {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: fixture.ownerId,
      name: fixture.name,
      type: fixture.type,
      currency: "THB",
      openingAmount: fixture.openingAmount,
      openingDate: fixture.openingDate,
    })
    .returning({ id: wallets.id });
  return row.id;
}

describe("listWallets", () => {
  test("lists an opened wallet with its opening balance as the balance", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await insertWallet(db, {
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
          archivedAt: null,
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
        await insertWallet(db, {
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

  test("lists wallets of every type in creation order", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      for (const type of ["cash", "bank_account", "e_wallet"] as const) {
        await insertWallet(db, {
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
      await insertWallet(db, {
        ownerId: owner.id,
        name: "Big",
        type: "bank_account",
        openingAmount: 9_999_999_999n,
        openingDate: "2026-09-01",
      });
      await insertWallet(db, {
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
      await insertWallet(db, {
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
        await insertWallet(db, {
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

describe("findWallet", () => {
  test("returns an owned wallet with the same balance the listing shows", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const id = await insertWallet(db, {
        ownerId: owner.id,
        name: "Cash",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });

      const [listed] = await listWallets(db, { ownerId: owner.id });
      expect(await findWallet(db, { ownerId: owner.id, id })).toEqual(listed);
    });
  });

  test("another owner's wallet is not found", async () => {
    await withRollback(async (db) => {
      const alice = await createTestUser(db);
      const bob = await createTestUser(db);
      const id = await insertWallet(db, {
        ownerId: alice.id,
        name: "Alice cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });

      expect(await findWallet(db, { ownerId: bob.id, id })).toBeNull();
    });
  });

  test("an unknown identifier is not found", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      expect(
        await findWallet(db, {
          ownerId: owner.id,
          id: "01999999-0000-7000-8000-000000000000",
        }),
      ).toBeNull();
    });
  });
  test("an identifier that is not a uuid is not found rather than a fault", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      expect(await findWallet(db, { ownerId: owner.id, id: "abc" })).toBeNull();
    });
  });
});
