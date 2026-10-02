import type { CalendarDate } from "@bookkeeping/domain/dates";
import type {
  FetchQueryOptions,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@/core/api/openapi.gen";
import { reportQueries, walletQueries } from "@/core/api/queries";
import { createBalanceTrend } from "./balance-trend";
import { createCategoryBreakdown } from "./category-breakdown";
import type { ReportSearch, ReportValues } from "./report-schema";
import { reportSchema, reportValues } from "./report-schema";
import { createTrendSeries, trendMonths } from "./trend-series";

type ClosingBalances = components["schemas"]["ClosingBalances"];

/** Keeps a typed observation and its preload together in the one inventory. */
function reportRead<Data, Key extends QueryKey>(
  options: Readonly<FetchQueryOptions<Data, Error, Data, Key>>,
) {
  return {
    options,
    preload(queryClient: QueryClient) {
      return queryClient.ensureQueryData(options);
    },
  };
}

function createReportReads(
  search: Readonly<ReportSearch>,
  today: CalendarDate,
) {
  const values = reportValues(search, today);
  const parsed = reportSchema.safeParse(values);
  const invalidFields = new Set<keyof ReportValues>();
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "month" || field === "asOf") {
        invalidFields.add(field);
      }
    }
  }
  return {
    valid: parsed.success,
    values,
    invalidFields,
    base: {
      monthly: reportRead(reportQueries.monthly(values.month)),
      categorySpending: reportRead(
        reportQueries.categorySpending(values.month),
      ),
      closingBalances: reportRead(reportQueries.closingBalances(values.month)),
      currentWallets: reportRead(walletQueries.list()),
      datedWallets: reportRead(walletQueries.list({ asOf: values.asOf })),
    },
    trend: parsed.success
      ? trendMonths(values.month).map((month) =>
          reportRead(reportQueries.monthly(month)),
        )
      : [],
  };
}

interface PreloadReportsOptions {
  queryClient: QueryClient;
  search: Readonly<ReportSearch>;
  today: CalendarDate;
}

export async function preloadReports({
  queryClient,
  search,
  today,
}: Readonly<PreloadReportsOptions>) {
  const reads = createReportReads(search, today);
  if (reads.valid) {
    await Promise.all(
      [...Object.values(reads.base), ...reads.trend].map((read) =>
        read.preload(queryClient),
      ),
    );
  }
}

/** A pending comparison may supply totals, but never another Wallet's figures. */
function totalsOnly(balances: Readonly<ClosingBalances>): ClosingBalances {
  return {
    month: balances.month,
    entries: balances.entries.map(({ date, total }) => ({ date, total })),
  };
}

interface UseReportReadsOptions {
  search: Readonly<ReportSearch>;
  today: CalendarDate;
  comparedWalletId: string | undefined;
}

/** All report readiness and comparison identity stay behind this interface. */
export function useReportReads({
  search,
  today,
  comparedWalletId,
}: Readonly<UseReportReadsOptions>) {
  const reads = createReportReads(search, today);
  const queryClient = useQueryClient();
  const observation = { enabled: reads.valid, throwOnError: true };
  const report = useQuery({ ...reads.base.monthly.options, ...observation });
  const categorySpending = useQuery({
    ...reads.base.categorySpending.options,
    ...observation,
  });
  const closingBalances = useQuery({
    ...reportQueries.closingBalances(reads.values.month, comparedWalletId),
    ...observation,
    placeholderData: (previous) =>
      previous?.month === reads.values.month
        ? previous
        : queryClient.getQueryData(reads.base.closingBalances.options.queryKey),
  });
  const currentWallets = useQuery({
    ...reads.base.currentWallets.options,
    ...observation,
  });
  const datedWallets = useQuery({
    ...reads.base.datedWallets.options,
    ...observation,
  });
  const trendQueries = useQueries({
    queries: reads.trend.map((read) => ({
      ...read.options,
      throwOnError: true,
    })),
  });
  const controls = { values: reads.values, invalidFields: reads.invalidFields };
  if (!reads.valid) {
    return { ...controls, state: "invalid" as const };
  }
  const trendReports = trendQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  if (
    report.data === undefined ||
    categorySpending.data === undefined ||
    closingBalances.data === undefined ||
    currentWallets.data === undefined ||
    datedWallets.data === undefined ||
    trendReports.length !== reads.trend.length
  ) {
    return { ...controls, state: "loading" as const };
  }
  return {
    ...controls,
    state: "ready" as const,
    summary: report.data,
    categoryBreakdown: createCategoryBreakdown(categorySpending.data),
    balanceTrend: createBalanceTrend(
      closingBalances.isPlaceholderData
        ? totalsOnly(closingBalances.data)
        : closingBalances.data,
      reads.values.asOf,
    ),
    trend: createTrendSeries(trendReports),
    currentWallets: currentWallets.data.items,
    datedWallets: datedWallets.data.items,
  };
}
