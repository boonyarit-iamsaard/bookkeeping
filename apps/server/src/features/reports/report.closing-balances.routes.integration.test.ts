import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { afterEach, describe, expect, test, vi } from "vitest";
import { presentMoney } from "../../core/http/money.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import type { ReportRequest } from "../../testing/report-fixture.js";
import {
  createOwner,
  defaultCategories,
} from "../../testing/report-fixture.js";
import { walletCollectionResponseSchema } from "../wallets/wallet.routes.js";
import { closingBalancesResponseSchema } from "./report.routes.js";

const { withRollback } = setupTestDatabase();

const CLOSING_BALANCES_URL = `${TEST_API_ORIGIN}/v1/reports/closing-balances`;
const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;

function getClosingBalances(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${CLOSING_BALANCES_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface DatedRead {
  cookie: string;
  month: string;
  walletId?: string;
}

async function readClosingBalances(
  app: Hono<AppEnv>,
  { cookie, month, walletId }: Readonly<DatedRead>,
) {
  const response = await getClosingBalances(app, {
    cookie,
    query: `month=${month}${walletId ? `&walletId=${walletId}` : ""}`,
  });
  expect(response.status).toBe(200);
  return closingBalancesResponseSchema.parse(await response.json());
}

interface WalletTotalRead {
  cookie: string;
  asOf: string;
}

/** The wallet collection's as-of balances summed: what the line must match. */
async function readWalletTotal(
  app: Hono<AppEnv>,
  { cookie, asOf }: Readonly<WalletTotalRead>,
) {
  const response = await app.request(`${WALLETS_URL}?asOf=${asOf}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
  expect(response.status).toBe(200);
  const { items } = walletCollectionResponseSchema.parse(await response.json());
  const total = items.reduce(
    (sum, wallet) => sum + BigInt(wallet.balance.value.replace(".", "")),
    0n,
  );
  return presentMoney({ amountInMinorUnits: total, currency: "THB" });
}

interface WalletBalanceRead {
  cookie: string;
  walletId: string;
  asOf: string;
}

/** One wallet's as-of balance in the wallet collection: what its line must match. */
async function readWalletBalance(
  app: Hono<AppEnv>,
  { cookie, walletId, asOf }: Readonly<WalletBalanceRead>,
) {
  const response = await app.request(`${WALLETS_URL}?asOf=${asOf}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
  expect(response.status).toBe(200);
  const { items } = walletCollectionResponseSchema.parse(await response.json());
  return items.find((wallet) => wallet.id === walletId)?.balance;
}

/** Mid-afternoon on 13 Sep 2026 in Bangkok. */
const MID_SEPTEMBER = new Date("2026-09-13T08:00:00Z");

describe("GET /v1/reports/closing-balances", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("totals every wallet's Closing balance per day, transfers unchanged and archived wallets counted", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.bankId,
        categoryId: categories.income,
        amount: 300_000n,
        transactionDate: "2026-09-03",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-04",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: expenseId,
        amount: 10_000n,
        transactionDate: "2026-09-05",
      });
      const deletedId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 70_000n,
        transactionDate: "2026-09-05",
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, deletedId));
      // Archived holdings stay in the total, as on Wallet balances.
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));

      const balances = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });

      expect(balances.month).toBe("2026-09");
      expect(balances.entries).toHaveLength(30);
      expect(balances.entries.slice(0, 6)).toEqual([
        { date: "2026-09-01", total: { value: "10000.00", currency: "THB" } },
        { date: "2026-09-02", total: { value: "9500.00", currency: "THB" } },
        { date: "2026-09-03", total: { value: "12500.00", currency: "THB" } },
        // The transfer moves money between wallets, not out of the total.
        { date: "2026-09-04", total: { value: "12500.00", currency: "THB" } },
        { date: "2026-09-05", total: { value: "12600.00", currency: "THB" } },
        { date: "2026-09-06", total: { value: "12600.00", currency: "THB" } },
      ]);
      for (const entry of balances.entries) {
        expect(entry.total).toEqual(
          await readWalletTotal(app, {
            cookie: owner.cookie,
            asOf: entry.date,
          }),
        );
      }
    });
  });

  test("carries the balance into the month and is null before every opening date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      await initializeDefaultCategories(db, ownerId);
      const categories = await defaultCategories(db, ownerId);
      const [early] = await db
        .insert(wallets)
        .values([
          {
            userId: ownerId,
            name: "Early",
            type: "cash",
            currency: "THB",
            openingAmount: 100_000n,
            openingDate: "2026-08-10",
          },
          {
            userId: ownerId,
            name: "Late",
            type: "cash",
            currency: "THB",
            openingAmount: 50_000n,
            openingDate: "2026-09-20",
          },
        ])
        .returning({ id: wallets.id });
      if (!early) {
        throw new Error("Wallet inserts returned no rows");
      }
      await insertTransaction(db, {
        ownerId,
        type: "expense",
        walletId: early.id,
        categoryId: categories.expense,
        amount: 30_000n,
        transactionDate: "2026-08-15",
      });

      const august = await readClosingBalances(app, {
        cookie,
        month: "2026-08",
      });
      expect(august.entries).toHaveLength(31);
      expect(august.entries.slice(8, 10)).toEqual([
        { date: "2026-08-09", total: null },
        { date: "2026-08-10", total: { value: "1000.00", currency: "THB" } },
      ]);
      expect(august.entries.at(-1)).toEqual({
        date: "2026-08-31",
        total: { value: "700.00", currency: "THB" },
      });

      const september = await readClosingBalances(app, {
        cookie,
        month: "2026-09",
      });
      expect(september.entries[0]).toEqual({
        date: "2026-09-01",
        total: { value: "700.00", currency: "THB" },
      });
      // A wallet joins the total on its opening date.
      expect(september.entries.slice(18, 20)).toEqual([
        { date: "2026-09-19", total: { value: "700.00", currency: "THB" } },
        { date: "2026-09-20", total: { value: "1200.00", currency: "THB" } },
      ]);

      const july = await readClosingBalances(app, { cookie, month: "2026-07" });
      expect(july.entries).toHaveLength(31);
      expect(july.entries.every((entry) => entry.total === null)).toBe(true);
    });
  });

  test("stops at today, has no entries for a future month, and ignores other owners", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MID_SEPTEMBER);
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const stranger = await createOwnerSession(db);

      const september = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });
      expect(september.entries).toHaveLength(13);
      expect(september.entries.at(-1)).toEqual({
        date: "2026-09-13",
        total: { value: "10000.00", currency: "THB" },
      });

      expect(
        await readClosingBalances(app, {
          cookie: owner.cookie,
          month: "2026-10",
        }),
      ).toEqual({ month: "2026-10", entries: [] });

      // Without wallets, every day is before an opening date.
      const strangers = await readClosingBalances(app, {
        cookie: stranger.cookie,
        month: "2026-09",
      });
      expect(strangers.entries).toHaveLength(13);
      expect(strangers.entries.every((entry) => entry.total === null)).toBe(
        true,
      );
    });
  });

  test("reads one wallet's Closing balance beside the total, the transfer moving only the wallet", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.bankId,
        categoryId: categories.income,
        amount: 300_000n,
        transactionDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-03",
      });
      // An archived wallet can still be compared.
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));

      const balances = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
        walletId: owner.bankId,
      });

      expect(balances.entries).toHaveLength(30);
      expect(balances.entries.slice(0, 4)).toEqual([
        {
          date: "2026-09-01",
          total: { value: "10000.00", currency: "THB" },
          wallet: { value: "0.00", currency: "THB" },
        },
        {
          date: "2026-09-02",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "3000.00", currency: "THB" },
        },
        {
          date: "2026-09-03",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "5000.00", currency: "THB" },
        },
        {
          date: "2026-09-04",
          total: { value: "13000.00", currency: "THB" },
          wallet: { value: "5000.00", currency: "THB" },
        },
      ]);
      for (const entry of balances.entries) {
        expect(entry.wallet).toEqual(
          await readWalletBalance(app, {
            cookie: owner.cookie,
            walletId: owner.bankId,
            asOf: entry.date,
          }),
        );
      }

      // Without a wallet requested, entries carry the total alone.
      const totalOnly = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
      });
      expect(totalOnly.entries[0]).toEqual({
        date: "2026-09-01",
        total: { value: "10000.00", currency: "THB" },
      });
    });
  });

  test("a wallet's figure is null before its opening date, even after the total starts", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const [late] = await db
        .insert(wallets)
        .values({
          userId: owner.ownerId,
          name: "Late",
          type: "cash",
          currency: "THB",
          openingAmount: 50_000n,
          openingDate: "2026-09-20",
        })
        .returning({ id: wallets.id });
      if (!late) {
        throw new Error("Wallet insert returned no rows");
      }

      const september = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-09",
        walletId: late.id,
      });
      expect(september.entries.slice(18, 20)).toEqual([
        {
          date: "2026-09-19",
          total: { value: "10000.00", currency: "THB" },
          wallet: null,
        },
        {
          date: "2026-09-20",
          total: { value: "10500.00", currency: "THB" },
          wallet: { value: "500.00", currency: "THB" },
        },
      ]);

      const august = await readClosingBalances(app, {
        cookie: owner.cookie,
        month: "2026-08",
        walletId: late.id,
      });
      expect(
        august.entries.every(
          (entry) => entry.total === null && entry.wallet === null,
        ),
      ).toBe(true);
    });
  });

  test("another owner's or an unknown wallet is not found, even for a future month", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const stranger = await createOwner({ db });

      for (const query of [
        `month=2026-09&walletId=${stranger.cashId}`,
        "month=2026-09&walletId=00000000-0000-4000-8000-000000000000",
        `month=2999-01&walletId=${stranger.cashId}`,
      ]) {
        await expectProblem(
          await getClosingBalances(app, { cookie: owner.cookie, query }),
          { status: 404, code: "not-found" },
        );
      }
      await expectProblem(
        await getClosingBalances(app, {
          cookie: owner.cookie,
          query: "month=2026-09&walletId=not-a-wallet",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("a malformed month is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      for (const query of [
        "month=2026-13",
        "month=2026-00",
        "month=26-09",
        "month=2026-09-01",
        "month=0000-01",
        "month=",
        "month=2026-09&from=2026-09-01",
      ]) {
        await expectProblem(
          await getClosingBalances(app, { cookie: owner.cookie, query }),
          { status: 400, code: "bad-request" },
        );
      }
      await expectProblem(
        await getClosingBalances(app, { cookie: owner.cookie }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});
