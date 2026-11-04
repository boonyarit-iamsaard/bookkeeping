import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import type { ReportRequest } from "../../testing/report-fixture.js";
import {
  createOwner,
  defaultCategories,
} from "../../testing/report-fixture.js";
import { dailyReportResponseSchema } from "./report.routes.js";

const { withRollback } = setupTestDatabase();

const DAILY_REPORT_URL = `${TEST_API_ORIGIN}/v1/reports/daily`;

function getDailyReport(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ReportRequest> = {},
) {
  return app.request(`${DAILY_REPORT_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

describe("GET /v1/reports/daily", () => {
  test("serializes the caller's day as canonical money, leaving other owners out", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });
      const foreign = await createOwner({ db });
      const categories = await defaultCategories(db, owner.ownerId);
      const foreignCategories = await defaultCategories(db, foreign.ownerId);
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: categories.income,
        amount: 100_000n,
        transactionDate: "2026-09-10",
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: categories.expense,
        amount: 50_000n,
        transactionDate: "2026-09-10",
      });
      await insertTransaction(db, {
        ownerId: foreign.ownerId,
        type: "income",
        walletId: foreign.cashId,
        categoryId: foreignCategories.income,
        amount: 777_000n,
        transactionDate: "2026-09-10",
      });

      const response = await getDailyReport(app, {
        cookie: owner.cookie,
        query: "date=2026-09-10",
      });
      const report = dailyReportResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(report).toEqual({
        date: "2026-09-10",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "500.00", currency: "THB" },
        net: { value: "500.00", currency: "THB" },
        transactionCount: 2,
      });
    });
  });

  test("reports a day with nothing as zeros", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      const report = dailyReportResponseSchema.parse(
        await (
          await getDailyReport(app, {
            cookie: owner.cookie,
            query: "date=2026-09-10",
          })
        ).json(),
      );
      expect(report).toEqual({
        date: "2026-09-10",
        income: { value: "0.00", currency: "THB" },
        grossExpenses: { value: "0.00", currency: "THB" },
        refunds: { value: "0.00", currency: "THB" },
        netExpenses: { value: "0.00", currency: "THB" },
        net: { value: "0.00", currency: "THB" },
        transactionCount: 0,
      });
    });
  });

  test("an impossible date is a bad request and the read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createOwner({ db });

      await expectProblem(
        await getDailyReport(app, {
          cookie: owner.cookie,
          query: "date=2026-02-30",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(
        await getDailyReport(app, { query: "date=2026-09-10" }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});
