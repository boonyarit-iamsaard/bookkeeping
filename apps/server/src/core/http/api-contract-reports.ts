import type * as z from "zod";
import {
  categorySpendingResponseSchema,
  closingBalancesResponseSchema,
  dailyReportResponseSchema,
  monthlyReportResponseSchema,
} from "../../features/reports/report.routes.js";

interface ReportExchange {
  operationId: string;
  method: string;
  path: string;
  schema: z.ZodType;
  response: Response;
}

interface ReportExchangesOptions {
  call: (request: { path: string }) => Promise<Response>;
  record: (exchange: ReportExchange) => Response;
  cashId: string;
  /** A YYYY-MM month; the daily report reads its first day. */
  month: string;
}

/** Records one exchange per report operation for the contract test. */
export async function recordReportExchanges({
  call,
  record,
  cashId,
  month,
}: Readonly<ReportExchangesOptions>): Promise<void> {
  record({
    operationId: "getMonthlyReport",
    method: "get",
    path: "/v1/reports/monthly",
    schema: monthlyReportResponseSchema,
    response: await call({ path: `/v1/reports/monthly?month=${month}` }),
  });
  record({
    operationId: "getDailyReport",
    method: "get",
    path: "/v1/reports/daily",
    schema: dailyReportResponseSchema,
    response: await call({ path: `/v1/reports/daily?date=${month}-01` }),
  });
  record({
    operationId: "getCategorySpending",
    method: "get",
    path: "/v1/reports/category-spending",
    schema: categorySpendingResponseSchema,
    response: await call({
      path: `/v1/reports/category-spending?month=${month}`,
    }),
  });
  record({
    operationId: "getClosingBalances",
    method: "get",
    path: "/v1/reports/closing-balances",
    schema: closingBalancesResponseSchema,
    response: await call({
      path: `/v1/reports/closing-balances?month=${month}&walletId=${cashId}`,
    }),
  });
}
