import {
  allowOtherAccountsFlag,
  demoAccountEmail,
} from "@bookkeeping/database/demo-account";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { describe, expect, test } from "vitest";
import { seedSampleLedger } from "./sample-ledger";
import {
  addOtherAccount,
  otherAccountEmail,
  readOwnedRecords,
  readWalletBalances,
  signIn,
  withMigratedDatabase,
} from "./testing/demo-ledger";

// Migrating an empty database can exceed Vitest's 5 s default on a loaded
// machine; matches the integration project's hookTimeout.
const seedTestOptions = { timeout: 60_000 };

function countsOf(records: Awaited<ReturnType<typeof readOwnedRecords>>) {
  return {
    accounts: records.accounts,
    wallets: records.wallets.length,
    categories: records.categories.length,
    tags: records.tags.length,
    transactions: records.transactions.length,
  };
}

describe("seedSampleLedger", () => {
  test("refuses a database that is not on this machine before connecting", async () => {
    await expect(
      seedSampleLedger("postgresql://u:p@db.invalid:5432/bookkeeping"),
    ).rejects.toThrow('non-local database host "db.invalid"');
  });

  test(
    "returns credentials that sign in to the demo Account",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        const credentials = await seedSampleLedger(url);

        const session = await signIn(url, credentials);

        expect(credentials.email).toBe(demoAccountEmail);
        expect(session.user.email).toBe(demoAccountEmail);
      });
    },
  );

  test(
    "a second run leaves one demo Account with the same record counts",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        const first = await seedSampleLedger(url);
        const countsAfterFirst = countsOf(
          await readOwnedRecords(url, demoAccountEmail),
        );

        const second = await seedSampleLedger(url);

        expect(second).toEqual(first);
        expect(countsOf(await readOwnedRecords(url, demoAccountEmail))).toEqual(
          countsAfterFirst,
        );
        expect(countsAfterFirst.accounts).toBe(1);
      });
    },
  );

  test(
    "gives the demo Account Wallets that exercise long names, big balances, Savings and archiving",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        await seedSampleLedger(url);

        const { wallets, balance } = await readWalletBalances(
          url,
          demoAccountEmail,
        );

        expect(wallets.some((wallet) => wallet.archivedAt !== null)).toBe(true);
        expect(wallets.some((wallet) => wallet.savings)).toBe(true);
        expect(wallets.some((wallet) => wallet.name.length >= 30)).toBe(true);
        // Seven digits of baht, in satang.
        expect(wallets.some((wallet) => wallet.balance >= 100_000_000n)).toBe(
          true,
        );
        expect(balance.spendable).toBeGreaterThan(0n);
        expect(balance.setAside).toBeGreaterThan(0n);
      });
    },
  );

  test(
    "gives the demo Account long Parent › Child category names and about 16 Tags",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        await seedSampleLedger(url);

        const { categories, tags } = await readOwnedRecords(
          url,
          demoAccountEmail,
        );

        for (const kind of ["income", "expense"]) {
          const longLabels = categories.filter((child) => {
            const parent = categories.find(({ id }) => id === child.parentId);
            return (
              child.kind === kind &&
              parent !== undefined &&
              `${parent.name} › ${child.name}`.length >= 60
            );
          });
          expect(longLabels.length, kind).toBeGreaterThan(0);
        }
        expect(tags.length).toBeGreaterThanOrEqual(16);
        expect(
          tags.filter((tag) => tag.name.length >= 25).length,
        ).toBeGreaterThanOrEqual(5);
      });
    },
  );

  test(
    "gives the demo Account every transaction type across several Report months up to today",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        await seedSampleLedger(url);

        const { transactions, tagLinks } = await readOwnedRecords(
          url,
          demoAccountEmail,
        );

        expect(transactions.length).toBeGreaterThan(10);
        expect(new Set(transactions.map(({ type }) => type))).toEqual(
          new Set(["income", "expense", "transfer", "refund"]),
        );
        const months = new Set(
          transactions.map(({ transactionDate }) =>
            transactionDate.slice(0, 7),
          ),
        );
        expect(months.size).toBeGreaterThanOrEqual(4);
        const today = todayIn({ timeZone: APP_TIME_ZONE });
        expect(months.has(today.slice(0, 7))).toBe(true);
        expect(
          transactions.every(({ transactionDate }) => transactionDate <= today),
        ).toBe(true);
        expect(transactions.some(({ note }) => note !== "")).toBe(true);
        expect(transactions.some(({ note }) => note === "")).toBe(true);
        const tagCounts = transactions.map(
          ({ id }) =>
            tagLinks.filter(({ transactionId }) => transactionId === id).length,
        );
        expect(tagCounts).toContain(0);
        expect(Math.max(...tagCounts)).toBe(5);
      });
    },
  );

  test(
    "refuses a database holding another Account and writes nothing",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        await addOtherAccount(url);

        await expect(seedSampleLedger(url)).rejects.toThrow(
          allowOtherAccountsFlag,
        );

        expect((await readOwnedRecords(url, demoAccountEmail)).accounts).toBe(
          0,
        );
      });
    },
  );

  test(
    "with the flag, seeds beside another Account and leaves its records alone",
    seedTestOptions,
    async () => {
      await withMigratedDatabase(async (url) => {
        await addOtherAccount(url);
        const before = countsOf(await readOwnedRecords(url, otherAccountEmail));

        await seedSampleLedger(url, { allowOtherAccounts: true });
        await seedSampleLedger(url, { allowOtherAccounts: true });

        expect(
          countsOf(await readOwnedRecords(url, otherAccountEmail)),
        ).toEqual(before);
        expect((await readOwnedRecords(url, demoAccountEmail)).accounts).toBe(
          1,
        );
      });
    },
  );
});
