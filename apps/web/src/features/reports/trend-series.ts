import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";

type MonthlyReport = components["schemas"]["MonthlyReport"];

const TREND_LENGTH = 6;
/** January of year 1, counted in months since year 0. */
const FIRST_MONTH_INDEX = 12;

/** The six months ending at `month` (YYYY-MM), oldest first, none before the calendar's first. */
export function trendMonths(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = year * 12 + (monthNumber - 1);
  const months: string[] = [];
  for (
    let index = Math.max(last - (TREND_LENGTH - 1), FIRST_MONTH_INDEX);
    index <= last;
    index += 1
  ) {
    const monthOfYear = (index % 12) + 1;
    months.push(
      `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(monthOfYear).padStart(2, "0")}`,
    );
  }
  return months;
}

export interface TrendPoint {
  month: string;
  income: bigint;
  netExpenses: bigint;
  /** No income, expenses or refunds were recorded that month. */
  empty: boolean;
}

/** One point per monthly report, in the order given. */
export function createTrendSeries(
  reports: readonly MonthlyReport[],
): TrendPoint[] {
  return reports.map((report) => ({
    month: report.month,
    income: parseApiMoney(report.income),
    netExpenses: parseApiMoney(report.netExpenses),
    empty: report.transactionCount === 0,
  }));
}
