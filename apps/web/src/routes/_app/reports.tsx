import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { ReportErrorBoundary } from "@/features/reports/components/report-error-boundary";
import { Reports } from "@/features/reports/components/reports";
import { createReportQueryPlan } from "@/features/reports/report-queries";
import { reportSearchSchema } from "@/features/reports/report-schema";
import { HistoryLoading } from "@/features/transactions/components/history-loading";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports" }] }),
  validateSearch: reportSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const initialToday = todayIn({ timeZone: APP_TIME_ZONE });
    const plan = createReportQueryPlan(deps.search, initialToday);
    if (plan.valid) {
      await Promise.all([
        context.queryClient.ensureQueryData(plan.monthly),
        context.queryClient.ensureQueryData(plan.currentWallets),
        context.queryClient.ensureQueryData(plan.datedWallets),
      ]);
    }
    return { initialToday };
  },
  pendingComponent: HistoryLoading,
  errorComponent: ReportErrorBoundary,
  component: ReportsRoute,
});

function ReportsRoute() {
  const search = Route.useSearch();
  const { initialToday } = Route.useLoaderData();
  return <Reports search={search} initialToday={initialToday} />;
}
