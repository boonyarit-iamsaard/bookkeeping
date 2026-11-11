import type { components } from "@/core/api/openapi.gen";
import type { BalanceTrend } from "./balance-trend";
import { createBalanceTrend } from "./balance-trend";
import type { CategoryBreakdown } from "./category-breakdown";
import { createCategoryBreakdown } from "./category-breakdown";
import type { ReportValues } from "./report-schema";
import type { TrendPoint } from "./trend-series";
import { createTrendSeries } from "./trend-series";

type ClosingBalances = components["schemas"]["ClosingBalances"];
type MonthlyReport = components["schemas"]["MonthlyReport"];
type CategorySpending = components["schemas"]["CategorySpending"];
type WalletCollection = components["schemas"]["WalletCollection"];

/** A pending comparison may supply totals, but never another Wallet's figures. */
export function totalsOnly(
  balances: Readonly<ClosingBalances>,
): ClosingBalances {
  return {
    month: balances.month,
    entries: balances.entries.map(({ date, total }) => ({ date, total })),
  };
}

interface ComparisonStandInOptions {
  /** The closing balances on screen before the comparison changed. */
  previous: Readonly<ClosingBalances> | undefined;
  /** The report month now being read. */
  month: string;
  /** The cached closing balances for `month` with no Wallet compared. */
  uncompared: Readonly<ClosingBalances> | undefined;
}

/**
 * The closing balances to show while a comparison loads: the previous ones
 * when they are for the same month, otherwise the uncompared ones cached for
 * the new month.
 */
export function comparisonStandIn({
  previous,
  month,
  uncompared,
}: Readonly<ComparisonStandInOptions>): ClosingBalances | undefined {
  return previous?.month === month ? previous : uncompared;
}

interface ReportControls {
  values: ReportValues;
  invalidFields: ReadonlySet<keyof ReportValues>;
}

interface ReportAddress extends ReportControls {
  valid: boolean;
}

/** Each read's current result; undefined while that read is pending. */
export interface ReportViewReads {
  monthly: MonthlyReport | undefined;
  categorySpending: CategorySpending | undefined;
  closingBalances: {
    data: ClosingBalances | undefined;
    /** The data holds the place of a comparison that is still loading. */
    isStandIn: boolean;
  };
  currentWallets: WalletCollection | undefined;
  datedWallets: WalletCollection | undefined;
  /** One entry per trend month, oldest first. */
  trend: readonly (MonthlyReport | undefined)[];
}

interface BuildReportViewOptions {
  address: Readonly<ReportAddress>;
  reads: Readonly<ReportViewReads>;
}

export type ReportView =
  | ({ state: "invalid" } & ReportControls)
  | ({ state: "loading" } & ReportControls)
  | ({
      state: "ready";
      summary: MonthlyReport;
      categoryBreakdown: CategoryBreakdown;
      balanceTrend: BalanceTrend;
      trend: TrendPoint[];
      currentWallets: WalletCollection["items"];
      currentTotal: WalletCollection["balance"]["total"];
      datedWallets: WalletCollection["items"];
      datedTotal: WalletCollection["balance"]["total"];
    } & ReportControls);

/** Invalid when the address is, loading until every read is in, else ready. */
export function buildReportView({
  address,
  reads,
}: Readonly<BuildReportViewOptions>): ReportView {
  const controls = {
    values: address.values,
    invalidFields: address.invalidFields,
  };
  if (!address.valid) {
    return { ...controls, state: "invalid" };
  }
  const { monthly, categorySpending, closingBalances } = reads;
  const { currentWallets, datedWallets } = reads;
  const trendReports = reads.trend.filter((report) => report !== undefined);
  if (
    monthly === undefined ||
    categorySpending === undefined ||
    closingBalances.data === undefined ||
    currentWallets === undefined ||
    datedWallets === undefined ||
    trendReports.length !== reads.trend.length
  ) {
    return { ...controls, state: "loading" };
  }
  return {
    ...controls,
    state: "ready",
    summary: monthly,
    categoryBreakdown: createCategoryBreakdown(categorySpending),
    balanceTrend: createBalanceTrend(
      closingBalances.isStandIn
        ? totalsOnly(closingBalances.data)
        : closingBalances.data,
      address.values.asOf,
    ),
    trend: createTrendSeries(trendReports),
    currentWallets: currentWallets.items,
    currentTotal: currentWallets.balance.total,
    datedWallets: datedWallets.items,
    datedTotal: datedWallets.balance.total,
  };
}
