import type { CalendarDate } from "@bookkeeping/domain/dates";
import type {
  FetchQueryOptions,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { reportQueries, walletQueries } from "@/core/api/queries";
import type { ReportSearch, ReportValues } from "./report-schema";
import { reportSchema, reportValues } from "./report-schema";
import type { ReportView } from "./report-view";
import { buildReportView, comparisonStandIn } from "./report-view";
import { trendMonths } from "./trend-series";

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

interface UseReportViewOptions {
  search: Readonly<ReportSearch>;
  today: CalendarDate;
  comparedWalletId: string | undefined;
}

/** Wires the report's reads into the report view; the view builder owns what they mean. */
export function useReportView({
  search,
  today,
  comparedWalletId,
}: Readonly<UseReportViewOptions>): ReportView {
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
      comparisonStandIn({
        previous,
        month: reads.values.month,
        uncompared: queryClient.getQueryData(
          reads.base.closingBalances.options.queryKey,
        ),
      }),
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
  return buildReportView({
    address: {
      valid: reads.valid,
      values: reads.values,
      invalidFields: reads.invalidFields,
    },
    reads: {
      monthly: report.data,
      categorySpending: categorySpending.data,
      closingBalances: {
        data: closingBalances.data,
        isStandIn: closingBalances.isPlaceholderData,
      },
      currentWallets: currentWallets.data,
      datedWallets: datedWallets.data,
      trend: trendQueries.map((query) => query.data),
    },
  });
}
