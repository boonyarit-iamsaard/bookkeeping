import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  signUpWithSession,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import { monthlyReportResponseSchema } from "./report.routes.js";

const { withRollback } = setupTestDatabase();

const REPORTS_URL = `${TEST_API_ORIGIN}/v1/reports/monthly`;

interface OwnerFixture {
  cookie: string;
  ownerId: string;
  cashId: string;
  bankId: string;
}

interface OwnerRequest {
  db: Database;
  label: string;
}

/** A fresh owner with two wallets and the default category trees. */
async function createOwner(
  app: Hono<AppEnv>,
  { db, label }: Readonly<OwnerRequest>,
): Promise<OwnerFixture> {
  const { cookie, ownerId } = await signUpWithSession(app, label);
  await initializeDefaultCategories(db, ownerId);
  const [cash, bank] = await db
    .insert(wallets)
    .values([
      {
        userId: ownerId,
        name: "Cash",
        type: "cash",
        currency: "THB",
        openingAmount: 1_000_000n,
        openingDate: "2026-09-01",
      },
      {
        userId: ownerId,
        name: "Bank",
        type: "bank_account",
        currency: "THB",
        openingAmount: 0n,
        openingDate: "2026-09-01",
      },
    ])
    .returning({ id: wallets.id });
  if (!cash || !bank) {
    throw new Error("Wallet inserts returned no rows");
  }
  return { cookie, ownerId, cashId: cash.id, bankId: bank.id };
}

/** The owner's protected income category and a default expense category. */
async function defaultCategories(db: Database, ownerId: string) {
  const tree = await listCategories(db, ownerId);
  const income = tree.find(
    (category) => category.kind === "income" && category.isProtected,
  );
  const expense = tree.find(
    (category) =>
      category.kind === "expense" && category.name === "Food & Drink",
  );
  if (!income || !expense) {
    throw new Error("Missing default categories");
  }
  return { income: income.id, expense: expense.id };
}

interface ReportRequest {
  cookie?: string;
  query?: string;
}

function getMonthlyReport(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${REPORTS_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

describe("GET /v1/reports/monthly", () => {
  test("totals a month as exact canonical money and excludes transfers", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "report-totals" });
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
        walletId: owner.cashId,
        categoryId: categories.income,
        amount: 100_000n,
        transactionDate: "2026-09-03",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 10_000n,
        transactionDate: "2026-09-04",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 200_000n,
        transactionDate: "2026-09-05",
      });

      const response = await getMonthlyReport(app, {
        cookie: owner.cookie,
        query: "month=2026-09",
      });
      const report = monthlyReportResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(report).toEqual({
        month: "2026-09",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.00", currency: "THB" },
        refunds: { value: "100.00", currency: "THB" },
        netExpenses: { value: "400.00", currency: "THB" },
        net: { value: "600.00", currency: "THB" },
        transactionCount: 3,
      });
    });
  });

  test("counts refunds in their own transaction month and deleted transactions out", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "report-refund" });
      const categories = await defaultCategories(db, owner.ownerId);
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-30",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 5_000n,
        transactionDate: "2026-10-01",
      });
      const deletedIncomeId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: categories.income,
        amount: 70_000n,
        transactionDate: "2026-10-02",
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(eq(transactions.id, deletedIncomeId));

      const october = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-10",
          })
        ).json(),
      );
      expect(october).toEqual({
        month: "2026-10",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "50.00", currency: "THB" },
        netExpenses: { value: "-50.00", currency: "THB" },
        net: { value: "50.00", currency: "THB" },
        transactionCount: 1,
      });

      const september = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(september).toEqual({
        month: "2026-09",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "500.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "500.00", currency: "THB" },
        net: { value: "-500.00", currency: "THB" },
        transactionCount: 1,
      });
    });
  });

  test("reports an empty month and another owner's month as zeros", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "report-empty" });
      const foreign = await createOwner(app, { db, label: "report-foreign" });
      const categories = await defaultCategories(db, foreign.ownerId);
      await insertTransaction(db, {
        ownerId: foreign.ownerId,
        type: "income",
        walletId: foreign.cashId,
        categoryId: categories.income,
        amount: 700_000n,
        transactionDate: "2026-09-02",
      });

      const empty = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-08",
          })
        ).json(),
      );
      expect(empty).toEqual({
        month: "2026-08",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "0.00", currency: "THB" },
        net: { value: "0.00", currency: "THB" },
        transactionCount: 0,
      });

      const foreignMonth = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(foreignMonth).toEqual({
        month: "2026-09",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "0.00", currency: "THB" },
        net: { value: "0.00", currency: "THB" },
        transactionCount: 0,
      });
    });
  });

  test("carries aggregates past JavaScript's safe integers exactly", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "report-exact" });
      const categories = await defaultCategories(db, owner.ownerId);
      for (let index = 0; index < 3; index += 1) {
        await insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "income",
          walletId: owner.cashId,
          categoryId: categories.income,
          amount: 9_999_999_999n,
          transactionDate: "2026-09-02",
        });
      }

      const report = monthlyReportResponseSchema.parse(
        await (
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query: "month=2026-09",
          })
        ).json(),
      );
      expect(report.income).toEqual({ value: "299999999.97", currency: "THB" });
      expect(report.net).toEqual({ value: "299999999.97", currency: "THB" });
      expect(report.transactionCount).toBe(3);
    });
  });

  test("a malformed month is a bad request and every read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "report-guard" });

      for (const query of [
        "month=2026-13",
        "month=2026-00",
        "month=26-09",
        "month=2026-09-01",
        "month=0000-01",
        "month=",
      ]) {
        await expectProblem(
          await getMonthlyReport(app, {
            cookie: owner.cookie,
            query,
          }),
          { status: 400, code: "bad-request" },
        );
      }
      await expectProblem(
        await getMonthlyReport(app, { cookie: owner.cookie }),
        {
          status: 400,
          code: "bad-request",
        },
      );
      await expectProblem(
        await getMonthlyReport(app, {
          cookie: owner.cookie,
          query: "month=2026-09&from=2026-09-01",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(await getMonthlyReport(app), {
        status: 401,
        code: "unauthenticated",
      });
      await expectProblem(
        await getMonthlyReport(app, { query: "month=2026-09" }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});
