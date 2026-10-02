import {
  getCategorySpending,
  getMonthlySummary,
} from "@bookkeeping/application/transactions";
import type { Database } from "@bookkeeping/database/connection";
import { parseCalendarDate } from "@bookkeeping/domain/dates";
import type {
  CategorySpending,
  MonthlySummary,
} from "@bookkeeping/domain/transactions";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { moneySchema, presentMoney } from "../../core/http/money.js";
import {
  describeProblem,
  describeProblemResponse,
} from "../../core/http/openapi.js";
import type { problemDetailsSchema } from "../../core/http/problem-details.js";
import { getProblemOptionsForStatus } from "../../core/http/problem-details.js";
import type { QueryValidatedInput } from "../../core/http/request-validation.js";
import { createQueryMiddleware } from "../../core/http/request-validation.js";

export const monthlyReportResponseSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    income: moneySchema,
    grossExpenses: moneySchema,
    refunds: moneySchema,
    netExpenses: moneySchema,
    net: moneySchema,
    transactionCount: z.number().int().nonnegative(),
  })
  .meta({ id: "MonthlyReport" });

export type MonthlyReportResponse = z.infer<typeof monthlyReportResponseSchema>;

/** The month grammar the product reports in: YYYY-MM over real calendar months. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthlyReportQuerySchema = z.strictObject({
  month: z
    .string()
    .regex(MONTH_PATTERN)
    .refine(
      (value) => value >= "0001-01" && parseCalendarDate(`${value}-01`).ok,
    ),
});

const monthlyReportQueryMiddleware = createQueryMiddleware(
  monthlyReportQuerySchema,
);

function presentThb(amountInMinorUnits: bigint) {
  return presentMoney({ amountInMinorUnits, currency: "THB" });
}

export function presentMonthlyReport(
  summary: Readonly<MonthlySummary>,
): MonthlyReportResponse {
  // The schema constrains every transaction to THB, so the totals carry it.
  return {
    month: summary.month,
    income: presentThb(summary.income),
    grossExpenses: presentThb(summary.grossExpenses),
    refunds: presentThb(summary.refunds),
    netExpenses: presentThb(summary.netExpenses),
    net: presentThb(summary.net),
    transactionCount: summary.transactionCount,
  };
}

export const categorySpendingResponseSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    netExpenses: moneySchema,
    parents: z.array(
      z
        .object({
          id: z.uuid(),
          name: z.string(),
          sortOrder: z.number().int(),
          isUncategorized: z.boolean(),
          spending: moneySchema,
          directSpending: moneySchema,
          children: z.array(
            z
              .object({
                id: z.uuid(),
                name: z.string(),
                sortOrder: z.number().int(),
                spending: moneySchema,
              })
              .meta({ id: "ChildCategorySpending" }),
          ),
        })
        .meta({ id: "ParentCategorySpending" }),
    ),
  })
  .meta({ id: "CategorySpending" });

export type CategorySpendingResponse = z.infer<
  typeof categorySpendingResponseSchema
>;

export function presentCategorySpending(
  spending: Readonly<CategorySpending>,
): CategorySpendingResponse {
  // The schema constrains every transaction to THB, so the totals carry it.
  return {
    month: spending.month,
    netExpenses: presentThb(spending.netExpenses),
    parents: spending.parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      sortOrder: parent.sortOrder,
      isUncategorized: parent.isUncategorized,
      spending: presentThb(parent.spending),
      directSpending: presentThb(parent.directSpending),
      children: parent.children.map((child) => ({
        id: child.id,
        name: child.name,
        sortOrder: child.sortOrder,
        spending: presentThb(child.spending),
      })),
    })),
  };
}

const MONTHLY_REPORT_PATH = "/reports/monthly";
const CATEGORY_SPENDING_PATH = "/reports/category-spending";

export function createReportRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .get(
      MONTHLY_REPORT_PATH,
      describeRoute({
        operationId: "getMonthlyReport",
        summary: "Get a monthly report",
        description:
          "The signed-in owner's server-calculated totals for one month in " +
          "YYYY-MM form: income, gross expenses, refunds, net expenses, and " +
          "net as exact Money objects beside the number of counted " +
          "transactions. Totals follow Bangkok calendar dates, so a refund " +
          "counts in the month of its own transaction date, while transfers " +
          "and opening balances never count. A month with no counted " +
          "transactions reports every amount as zero with a transaction " +
          "count of zero; aggregates stay exact beyond JavaScript's safe " +
          "integers. A malformed or impossible month is a bad request.",
        tags: ["Reports"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      monthlyReportQueryMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof MONTHLY_REPORT_PATH,
        QueryValidatedInput<typeof monthlyReportQuerySchema>,
        {
          200: typeof monthlyReportResponseSchema;
          400: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const summary = await getMonthlySummary(db, {
            ownerId: c.get("session").user.id,
            month: c.req.valid("query").month,
          });
          return c.json(presentMonthlyReport(summary), 200);
        },
        {
          200: {
            description: "The owner's monthly report",
            content: {
              "application/json": { vSchema: monthlyReportResponseSchema },
            },
          },
          400: describeProblem(getProblemOptionsForStatus(400)),
        },
      ),
    )
    .get(
      CATEGORY_SPENDING_PATH,
      describeRoute({
        operationId: "getCategorySpending",
        summary: "Get a month's spending by category",
        description:
          "The signed-in owner's Category spending for one month in YYYY-MM " +
          "form, per expense parent category: expenses dated in the month " +
          "less refunds dated in the month, each counted under its expense's " +
          "current category and rolled up to the parent. Debt payments count " +
          "like any other category. Only parents with activity in the month " +
          "appear, in category order with Uncategorized last, and their " +
          "signed amounts sum to netExpenses, the monthly report's Net " +
          "expenses for the same month. Each parent carries the amount filed " +
          "directly on it and its children with activity, in category order; " +
          "the two add up to the parent. Any amount is negative when a " +
          "refund dated in the month outweighs that month's expenses. A " +
          "malformed or impossible month is a bad request.",
        tags: ["Reports"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      monthlyReportQueryMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof CATEGORY_SPENDING_PATH,
        QueryValidatedInput<typeof monthlyReportQuerySchema>,
        {
          200: typeof categorySpendingResponseSchema;
          400: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const spending = await getCategorySpending(db, {
            ownerId: c.get("session").user.id,
            month: c.req.valid("query").month,
          });
          return c.json(presentCategorySpending(spending), 200);
        },
        {
          200: {
            description: "The owner's spending by parent category",
            content: {
              "application/json": { vSchema: categorySpendingResponseSchema },
            },
          },
          400: describeProblem(getProblemOptionsForStatus(400)),
        },
      ),
    );
}
