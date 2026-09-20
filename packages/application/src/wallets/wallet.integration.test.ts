import type { Database } from "@bookkeeping/database/connection";
import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";
import {
  initializeDefaultCategories,
  listCategories,
} from "../categories/category";
import { insertRetainedTransferSnapshot } from "../testing/transaction-fixture";
import {
  createTransaction,
  deleteTransaction,
} from "../transactions/transaction";
import {
  createWallet,
  deleteWallet,
  findWallet,
  listWallets,
  replaceWalletOpening,
  setWalletArchived,
} from "./wallet";

const { withRollback, committed } = setupTestDatabase();

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

  test("overall balances retain satang beyond JavaScript integer precision and allow negative holdings", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await insertWallet(db, {
        ownerId: owner.id,
        name: "Large",
        type: "bank_account",
        openingAmount: 90_071_992_547_409_919n,
        openingDate: "2026-09-01",
      });
      await insertWallet(db, {
        ownerId: owner.id,
        name: "Negative",
        type: "cash",
        openingAmount: -123n,
        openingDate: "2026-09-02",
      });

      const dated = await listWallets(db, {
        ownerId: owner.id,
        asOf: "2026-09-01",
      });
      expect(dated.map((wallet) => wallet.balance)).toEqual([
        90_071_992_547_409_919n,
        0n,
      ]);
      const current = await listWallets(db, { ownerId: owner.id });
      expect(
        current.reduce((total, wallet) => total + wallet.balance, 0n),
      ).toBe(90_071_992_547_409_796n);
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

interface CreateWalletFixture {
  ownerId: string;
  idempotencyKey?: string;
  name?: string;
  type?: WalletType;
  openingAmount?: bigint;
  openingDate?: CalendarDate;
}

function createSavingsWallet(
  db: Database,
  {
    ownerId,
    idempotencyKey = "savings",
    name = "Kasikorn savings",
    type = "bank_account",
    openingAmount = 1_200_000n,
    openingDate = "2026-09-01",
  }: Readonly<CreateWalletFixture>,
) {
  return createWallet(db, {
    ownerId,
    idempotencyKey,
    name,
    type,
    openingAmount,
    openingDate,
  });
}

describe("createWallet", () => {
  test("a created wallet is listed with its opening balance as the balance", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      const created = await createSavingsWallet(db, { ownerId: owner.id });

      expect(created).toEqual({
        ok: true,
        value: {
          replayed: false,
          wallet: expect.objectContaining({
            name: "Kasikorn savings",
            type: "bank_account",
            currency: "THB",
            openingAmount: 1_200_000n,
            openingDate: "2026-09-01",
            archivedAt: null,
            balance: 1_200_000n,
          }),
        },
      });
      if (!created.ok) {
        throw new Error("Expected wallet creation to succeed");
      }
      expect(await listWallets(db, { ownerId: owner.id })).toEqual([
        created.value.wallet,
      ]);
    });
  });

  test("a retry with the same key replays the original wallet instead of opening another", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const first = await createSavingsWallet(db, { ownerId: owner.id });
      if (!first.ok) {
        throw new Error("Expected wallet creation to succeed");
      }

      const retry = await createSavingsWallet(db, { ownerId: owner.id });

      expect(retry).toEqual({
        ok: true,
        value: { wallet: first.value.wallet, replayed: true },
      });
      expect(await listWallets(db, { ownerId: owner.id })).toHaveLength(1);
    });
  });

  test("a retry replays the wallet as created even after it was archived or removed", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      const first = await createSavingsWallet(db, { ownerId: owner.id });
      if (!first.ok) {
        throw new Error("Expected wallet creation to succeed");
      }
      const { id } = first.value.wallet;

      await db
        .update(wallets)
        .set({ name: "Renamed", archivedAt: new Date("2026-09-10T00:00:00Z") })
        .where(eq(wallets.id, id));
      const afterChange = await createSavingsWallet(db, { ownerId: owner.id });
      await db.delete(wallets).where(eq(wallets.id, id));
      const afterRemoval = await createSavingsWallet(db, { ownerId: owner.id });

      expect(afterChange).toEqual({
        ok: true,
        value: { wallet: first.value.wallet, replayed: true },
      });
      expect(afterRemoval).toEqual(afterChange);
      expect(await listWallets(db, { ownerId: owner.id })).toEqual([]);
    });
  });

  test("a retry whose command differs conflicts and opens nothing", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);
      await createSavingsWallet(db, { ownerId: owner.id });

      const conflict = await createSavingsWallet(db, {
        ownerId: owner.id,
        openingAmount: 1_200_001n,
      });

      expect(conflict).toEqual({
        ok: false,
        error: { code: "idempotency-conflict" },
      });
      expect(await listWallets(db, { ownerId: owner.id })).toHaveLength(1);
    });
  });

  test("distinct keys open distinct wallets from the same command", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      await createSavingsWallet(db, { ownerId: owner.id, idempotencyKey: "a" });
      await createSavingsWallet(db, { ownerId: owner.id, idempotencyKey: "b" });

      expect(await listWallets(db, { ownerId: owner.id })).toHaveLength(2);
    });
  });

  test("a rejected command consumes nothing, so the corrected retry may reuse its key", async () => {
    await withRollback(async (db) => {
      const owner = await createTestUser(db);

      const rejected = await createSavingsWallet(db, {
        ownerId: owner.id,
        name: "   ",
        openingDate: "2026-02-30",
      });
      const corrected = await createSavingsWallet(db, { ownerId: owner.id });

      expect(rejected).toEqual({
        ok: false,
        error: {
          code: "invalid-wallet",
          issues: [
            { field: "name", code: "empty" },
            { field: "openingDate", code: "invalid" },
          ],
        },
      });
      expect(corrected.ok && corrected.value.replayed).toBe(false);
      expect(await listWallets(db, { ownerId: owner.id })).toEqual([
        expect.objectContaining({ name: "Kasikorn savings" }),
      ]);
    });
  });

  test("concurrent retries open one wallet and replay it to the rest", async () => {
    const db = committed();
    const owner = await createTestUser(db);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        createSavingsWallet(db, { ownerId: owner.id }),
      ),
    );

    const successes = outcomes.flatMap((outcome) =>
      outcome.ok ? [outcome.value] : [],
    );
    expect(successes).toHaveLength(5);
    expect(new Set(successes.map(({ wallet }) => wallet.id)).size).toBe(1);
    expect(successes.filter(({ replayed }) => !replayed)).toHaveLength(1);
    expect(await listWallets(db, { ownerId: owner.id })).toHaveLength(1);
  });
});

interface TransferFixture {
  ownerId: string;
  walletId: string;
  destinationWalletId: string;
  transactionDate: CalendarDate;
  amount?: bigint;
  deletedAt?: Date;
}

/**
 * Persists a transfer row directly; a transfer touches both wallets without
 * needing a category, and movements move here with their own tickets.
 */
async function insertTransfer(
  db: Database,
  fixture: Readonly<TransferFixture>,
) {
  const [row] = await db
    .insert(transactions)
    .values({
      userId: fixture.ownerId,
      type: "transfer",
      walletId: fixture.walletId,
      destinationWalletId: fixture.destinationWalletId,
      currency: "THB",
      amount: fixture.amount ?? 100n,
      transactionDate: fixture.transactionDate,
      deletedAt: fixture.deletedAt,
    })
    .returning({ id: transactions.id, recordedAt: transactions.recordedAt });
  return row;
}

async function openCashPair(db: Database) {
  const owner = await createTestUser(db);
  const cash = await createSavingsWallet(db, {
    ownerId: owner.id,
    idempotencyKey: "cash",
    name: "Cash",
    type: "cash",
    openingAmount: 10_000n,
  });
  const bank = await createSavingsWallet(db, {
    ownerId: owner.id,
    idempotencyKey: "bank",
    name: "Bank",
    openingAmount: 10_000n,
  });
  if (!(cash.ok && bank.ok)) {
    throw new Error("Expected wallet creation to succeed");
  }
  return { owner, cash: cash.value.wallet, bank: bank.value.wallet };
}

async function listChanges(db: Database, walletId: string) {
  return db
    .select()
    .from(walletChanges)
    .where(eq(walletChanges.walletId, walletId));
}

describe("replaceWalletOpening", () => {
  test("replaces amount and date together, records the change, and keeps recording times", async () => {
    await withRollback(async (db) => {
      const { owner, cash, bank } = await openCashPair(db);
      const transfer = await insertTransfer(db, {
        ownerId: owner.id,
        walletId: cash.id,
        destinationWalletId: bank.id,
        transactionDate: "2026-09-02",
      });

      const replaced = await replaceWalletOpening(db, {
        ownerId: owner.id,
        id: cash.id,
        openingAmount: -99_999_999_999_999_999n,
        openingDate: "2026-09-02",
      });

      expect(replaced).toEqual({
        ok: true,
        value: {
          ...cash,
          openingAmount: -99_999_999_999_999_999n,
          openingDate: "2026-09-02",
          balance: -100_000_000_000_000_099n,
        },
      });
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        replaced.ok ? replaced.value : null,
      );
      const [row] = await db
        .select({ recordedAt: transactions.recordedAt })
        .from(transactions)
        .where(eq(transactions.id, transfer.id));
      expect(row?.recordedAt).toEqual(transfer.recordedAt);
      const changes = await listChanges(db, cash.id);
      expect(changes).toEqual([
        expect.objectContaining({
          userId: owner.id,
          action: "opening",
          before: {
            openingAmount: "10000",
            openingDate: "2026-09-01",
            archivedAt: null,
          },
          after: {
            openingAmount: "-99999999999999999",
            openingDate: "2026-09-02",
            archivedAt: null,
          },
        }),
      ]);
    });
  });

  test("replacing with the current opening changes nothing and records no history", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);

      const repeated = await replaceWalletOpening(db, {
        ownerId: owner.id,
        id: cash.id,
        openingAmount: 10_000n,
        openingDate: "2026-09-01",
      });

      expect(repeated).toEqual({ ok: true, value: cash });
      expect(await listChanges(db, cash.id)).toEqual([]);
    });
  });

  test("a movement before the proposed opening on either transfer side is rejected, even once deleted", async () => {
    await withRollback(async (db) => {
      const { owner, cash, bank } = await openCashPair(db);
      await insertTransfer(db, {
        ownerId: owner.id,
        walletId: cash.id,
        destinationWalletId: bank.id,
        transactionDate: "2026-09-02",
        deletedAt: new Date("2026-09-03T00:00:00Z"),
      });

      for (const id of [cash.id, bank.id]) {
        expect(
          await replaceWalletOpening(db, {
            ownerId: owner.id,
            id,
            openingAmount: 0n,
            openingDate: "2026-09-03",
          }),
        ).toEqual({ ok: false, error: { code: "movement-before-opening" } });
        expect(
          (
            await replaceWalletOpening(db, {
              ownerId: owner.id,
              id,
              openingAmount: 0n,
              openingDate: "2026-09-02",
            })
          ).ok,
        ).toBe(true);
      }
    });
  });

  test("an invalid opening is rejected before the wallet is touched", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);

      const rejected = await replaceWalletOpening(db, {
        ownerId: owner.id,
        id: cash.id,
        openingAmount: 1_000_000_000_000_000_00n,
        openingDate: "2999-01-01",
      });

      expect(rejected).toEqual({
        ok: false,
        error: {
          code: "invalid-opening",
          issues: [
            { field: "openingAmount", code: "out-of-range" },
            { field: "openingDate", code: "in-future" },
          ],
        },
      });
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        cash,
      );
      expect(await listChanges(db, cash.id)).toEqual([]);
    });
  });

  test("another owner's, an unknown, and a malformed wallet id are not found alike", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);
      const stranger = await createTestUser(db);

      for (const attempt of [
        { ownerId: stranger.id, id: cash.id },
        { ownerId: owner.id, id: "01999999-0000-7000-8000-000000000000" },
        { ownerId: owner.id, id: "not-a-uuid" },
      ]) {
        expect(
          await replaceWalletOpening(db, {
            ...attempt,
            openingAmount: 0n,
            openingDate: "2026-09-01",
          }),
        ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      }
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        cash,
      );
    });
  });
});

describe("setWalletArchived", () => {
  test("archives, records the change, and returns the updated wallet", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);

      const archived = await setWalletArchived(db, {
        ownerId: owner.id,
        id: cash.id,
        archived: true,
      });

      expect(archived).toEqual({
        ok: true,
        value: { ...cash, archivedAt: expect.any(Date) },
      });
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        archived.ok ? archived.value : null,
      );
      expect(await listChanges(db, cash.id)).toEqual([
        expect.objectContaining({
          userId: owner.id,
          action: "archive",
          before: {
            openingAmount: "10000",
            openingDate: "2026-09-01",
            archivedAt: null,
          },
          after: {
            openingAmount: "10000",
            openingDate: "2026-09-01",
            archivedAt: expect.anything(),
          },
        }),
      ]);
    });
  });

  test("restores by clearing the archived instant and records the change", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);
      const archived = await setWalletArchived(db, {
        ownerId: owner.id,
        id: cash.id,
        archived: true,
      });
      if (!archived.ok) {
        throw new Error("Archive failed");
      }

      const restored = await setWalletArchived(db, {
        ownerId: owner.id,
        id: cash.id,
        archived: false,
      });

      expect(restored).toEqual({ ok: true, value: cash });
      expect(await listChanges(db, cash.id)).toEqual([
        expect.objectContaining({ action: "archive" }),
        expect.objectContaining({
          action: "unarchive",
          before: {
            openingAmount: "10000",
            openingDate: "2026-09-01",
            archivedAt: expect.anything(),
          },
          after: {
            openingAmount: "10000",
            openingDate: "2026-09-01",
            archivedAt: null,
          },
        }),
      ]);
    });
  });

  test("repeating the same state changes nothing and records no history", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);

      const first = await setWalletArchived(db, {
        ownerId: owner.id,
        id: cash.id,
        archived: true,
      });
      const second = await setWalletArchived(db, {
        ownerId: owner.id,
        id: cash.id,
        archived: true,
      });

      expect(second).toEqual(first);
      expect(await listChanges(db, cash.id)).toHaveLength(1);
    });
  });

  test("another owner's, an unknown, and a malformed wallet id are not found alike", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);
      const stranger = await createTestUser(db);

      for (const attempt of [
        { ownerId: stranger.id, id: cash.id },
        { ownerId: owner.id, id: "01999999-0000-7000-8000-000000000000" },
        { ownerId: owner.id, id: "not-a-uuid" },
      ]) {
        expect(
          await setWalletArchived(db, { ...attempt, archived: true }),
        ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
      }
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        cash,
      );
      expect(await listChanges(db, cash.id)).toEqual([]);
    });
  });
});

describe("deleteWallet", () => {
  test("deletes an eligible wallet and treats a repeat as not found", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);

      expect(
        await deleteWallet(db, { ownerId: owner.id, id: cash.id }),
      ).toEqual({ ok: true, value: { id: cash.id } });
      expect(
        await findWallet(db, { ownerId: owner.id, id: cash.id }),
      ).toBeNull();
      expect(
        await deleteWallet(db, { ownerId: owner.id, id: cash.id }),
      ).toEqual({ ok: false, error: { code: "wallet-not-found" } });
    });
  });

  test("rejects wallets with current transactions on either transfer side", async () => {
    await withRollback(async (db) => {
      const { owner, cash, bank } = await openCashPair(db);
      await insertTransfer(db, {
        ownerId: owner.id,
        walletId: cash.id,
        destinationWalletId: bank.id,
        transactionDate: "2026-09-02",
      });

      for (const id of [cash.id, bank.id]) {
        expect(await deleteWallet(db, { ownerId: owner.id, id })).toEqual({
          ok: false,
          error: { code: "history-remains" },
        });
      }
    });
  });

  test("rejects a wallet with retained wallet change history", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);
      expect(
        await setWalletArchived(db, {
          ownerId: owner.id,
          id: cash.id,
          archived: true,
        }),
      ).toMatchObject({ ok: true });

      expect(
        await deleteWallet(db, { ownerId: owner.id, id: cash.id }),
      ).toEqual({ ok: false, error: { code: "history-remains" } });
    });
  });

  test("rejects a wallet referenced only by a retained transaction snapshot", async () => {
    await withRollback(async (db) => {
      const { owner, cash, bank } = await openCashPair(db);
      const spare = await createSavingsWallet(db, {
        ownerId: owner.id,
        idempotencyKey: "spare",
        name: "Spare",
      });
      if (!spare.ok) {
        throw new Error("Expected wallet creation to succeed");
      }
      await insertRetainedTransferSnapshot(db, {
        ownerId: owner.id,
        currentWalletId: bank.id,
        currentDestinationWalletId: spare.value.wallet.id,
        retainedWalletId: cash.id,
      });

      expect(
        await deleteWallet(db, { ownerId: owner.id, id: cash.id }),
      ).toEqual({ ok: false, error: { code: "history-remains" } });
    });
  });

  test("does not disclose an unknown or another owner's wallet", async () => {
    await withRollback(async (db) => {
      const { owner, cash } = await openCashPair(db);
      const stranger = await createTestUser(db);

      for (const attempt of [
        { ownerId: stranger.id, id: cash.id },
        { ownerId: owner.id, id: "01999999-0000-7000-8000-000000000000" },
        { ownerId: owner.id, id: "not-a-uuid" },
      ]) {
        expect(await deleteWallet(db, attempt)).toEqual({
          ok: false,
          error: { code: "wallet-not-found" },
        });
      }
      expect(await findWallet(db, { ownerId: owner.id, id: cash.id })).toEqual(
        cash,
      );
    });
  });
});

/** A cash pair whose owner can record an expense against the cash wallet. */
async function openCashPairWithExpense(db: Database) {
  const { owner, cash, bank } = await openCashPair(db);
  await initializeDefaultCategories(db, owner.id);
  const category = (await listCategories(db, owner.id)).find(
    (item) => item.kind === "expense",
  );
  if (!category) {
    throw new Error("Missing category");
  }
  const movement = {
    ownerId: owner.id,
    idempotencyKey: crypto.randomUUID(),
    type: "expense",
    walletId: cash.id,
    categoryId: category.id,
    amount: 100n,
    transactionDate: "2026-09-02",
    note: "",
  } as const;
  return {
    other: bank,
    movement,
    owned: { ownerId: owner.id, id: cash.id },
  };
}

describe("wallet lifecycle", () => {
  test("a deleted transfer still guards deletion and opening dates for both wallets", async () => {
    await withRollback(async (db) => {
      const { owned, movement, other } = await openCashPairWithExpense(db);
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

  test("archive through the application retains current/historical totals, rejects new archived wallets, and restores eligibility", async () => {
    await withRollback(async (db) => {
      const { owned, movement } = await openCashPairWithExpense(db);
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
          idempotencyKey: crypto.randomUUID(),
        }),
      ).toEqual({
        ok: false,
        error: { code: "wallet-archived", walletId: owned.id },
      });
      await setWalletArchived(db, { ...owned, archived: false });
      expect(
        (
          await createTransaction(db, {
            ...movement,
            idempotencyKey: crypto.randomUUID(),
          })
        ).ok,
      ).toBe(true);
    });
  });

  test("a create waiting behind archive rechecks eligibility after its lock is released", async () => {
    const db = committed();
    const { owned, movement } = await openCashPairWithExpense(db);
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
