import { getMonthlySummary } from "@bookkeeping/application/transactions";
import type { Database } from "@bookkeeping/database/connection";
import { parseCalendarDate } from "@bookkeeping/domain/dates";
import type { MonthlySummary } from "@bookkeeping/domain/transactions";
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

export function presentMonthlyReport(
  summary: Readonly<MonthlySummary>,
): MonthlyReportResponse {
  // The schema constrains every transaction to THB, so the totals carry it.
  return {
    month: summary.month,
    income: presentMoney({
      amountInMinorUnits: summary.income,
      currency: "THB",
    }),
    grossExpenses: presentMoney({
      amountInMinorUnits: summary.grossExpenses,
      currency: "THB",
    }),
    refunds: presentMoney({
      amountInMinorUnits: summary.refunds,
      currency: "THB",
    }),
    netExpenses: presentMoney({
      amountInMinorUnits: summary.netExpenses,
      currency: "THB",
    }),
    net: presentMoney({
      amountInMinorUnits: summary.net,
      currency: "THB",
    }),
    transactionCount: summary.transactionCount,
  };
}

const MONTHLY_REPORT_PATH = "/reports/monthly";

export function createReportRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>().get(
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
  );
}
