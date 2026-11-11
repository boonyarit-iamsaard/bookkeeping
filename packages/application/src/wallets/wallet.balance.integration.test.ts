import {
  createTestUser,
  setupTestDatabase,
} from "@bookkeeping/database/testing";
import { describe, expect, test } from "vitest";
import { insertTransaction } from "../testing/transaction-fixture";
import { withClock } from "../testing/transaction-suite-fixture";
import { archiveForTest, createWalletForTest } from "../testing/wallet-fixture";
import { getClosingBalances } from "../transactions/transaction-reports";
import { listWalletsWithBalance } from "./wallet";

const { withRollback } = setupTestDatabase();

describe("listWalletsWithBalance", () => {
  test("splits the signed Total balance over every Wallet, archived ones included", async () => {
    await withRollback(async (db) => {
      const { id: ownerId } = await createTestUser(db);
      const { id: cashId } = await createWalletForTest(db, {
        ownerId,
        name: "Cash",
        type: "bank_account",
        openingAmount: 5_000n,
        openingDate: "2026-09-01",
      });
      await createWalletForTest(db, {
        ownerId,
        name: "Overdraft",
        type: "bank_account",
        openingAmount: -20_000n,
        openingDate: "2026-09-01",
      });
      const { id: savingsId } = await createWalletForTest(db, {
        ownerId,
        name: "Rainy day",
        type: "bank_account",
        openingAmount: 100_000n,
        openingDate: "2026-09-01",
        savings: true,
      });
      await archiveForTest(db, { ownerId, id: savingsId });
      await insertTransaction(db, {
        ownerId,
        type: "transfer",
        walletId: savingsId,
        destinationWalletId: cashId,
        amount: 3_000n,
        transactionDate: "2026-09-05",
      });

      const listed = await listWalletsWithBalance(db, {
        ownerId,
        asOf: "2026-09-30",
      });

      expect(
        listed.wallets.map(({ name, balance }) => [name, balance]),
      ).toEqual([
        ["Cash", 8_000n],
        ["Overdraft", -20_000n],
        ["Rainy day", 97_000n],
      ]);
      expect(listed.balance).toEqual({
        total: 85_000n,
        spendable: -12_000n,
        setAside: 97_000n,
        walletCount: 3,
        spendableWalletCount: 2,
        savingsWalletCount: 1,
      });
    });
  });

  test("a date before a Wallet's opening leaves that Wallet out, and no Savings wallet leaves no Set aside", async () => {
    await withRollback(async (db) => {
      const { id: ownerId } = await createTestUser(db);
      await createWalletForTest(db, {
        ownerId,
        name: "Cash",
        type: "bank_account",
        openingAmount: 5_000n,
        openingDate: "2026-09-01",
      });
      await createWalletForTest(db, {
        ownerId,
        name: "Rainy day",
        type: "bank_account",
        openingAmount: 100_000n,
        openingDate: "2026-09-10",
        savings: true,
      });

      const listed = await listWalletsWithBalance(db, {
        ownerId,
        asOf: "2026-09-09",
      });

      expect(listed.wallets.map(({ name }) => name)).toEqual(["Cash"]);
      expect(listed.balance).toEqual({
        total: 5_000n,
        spendable: 5_000n,
        setAside: null,
        walletCount: 1,
        spendableWalletCount: 1,
        savingsWalletCount: 0,
      });
    });
  });

  test("a date before any opening lists no Wallet and has no Total balance", async () => {
    await withRollback(async (db) => {
      const { id: ownerId } = await createTestUser(db);
      await createWalletForTest(db, {
        ownerId,
        name: "Cash",
        type: "bank_account",
        openingAmount: 5_000n,
        openingDate: "2026-09-01",
      });

      expect(
        await listWalletsWithBalance(db, { ownerId, asOf: "2026-08-31" }),
      ).toEqual({
        wallets: [],
        balance: {
          total: null,
          spendable: null,
          setAside: null,
          walletCount: 0,
          spendableWalletCount: 0,
          savingsWalletCount: 0,
        },
      });
    });
  });

  test("agrees with the closing-balance series on every day of a month", async () => {
    await withClock("2026-09-30T05:00:00Z", async () => {
      await withRollback(async (db) => {
        const { id: ownerId } = await createTestUser(db);
        const { id: cashId } = await createWalletForTest(db, {
          ownerId,
          name: "Cash",
          type: "bank_account",
          openingAmount: 5_000n,
          openingDate: "2026-09-05",
        });
        const { id: savingsId } = await createWalletForTest(db, {
          ownerId,
          name: "Rainy day",
          type: "bank_account",
          openingAmount: -1_000n,
          openingDate: "2026-09-15",
          savings: true,
        });
        await archiveForTest(db, { ownerId, id: savingsId });
        await insertTransaction(db, {
          ownerId,
          type: "transfer",
          walletId: cashId,
          destinationWalletId: savingsId,
          amount: 2_500n,
          transactionDate: "2026-09-20",
        });

        const series = await getClosingBalances(db, {
          ownerId,
          month: "2026-09",
        });
        const entries = series?.entries ?? [];
        expect(entries).toHaveLength(30);
        for (const { date, total } of entries) {
          const listed = await listWalletsWithBalance(db, {
            ownerId,
            asOf: date,
          });
          expect([date, listed.balance.total]).toEqual([date, total]);
        }
        expect(entries.map(({ total }) => total)).toContain(null);
        expect(entries.at(-1)?.total).toBe(4_000n);
      });
    });
  });
});
