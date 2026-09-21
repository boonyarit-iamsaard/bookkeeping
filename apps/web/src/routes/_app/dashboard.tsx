import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/features/dashboard/components/dashboard";
import { createDashboardQueryPlan } from "@/features/dashboard/dashboard-queries";
import { reportSearchSchema } from "@/features/dashboard/report-schema";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Monthly summary" }] }),
  validateSearch: reportSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const initialToday = todayIn({ timeZone: APP_TIME_ZONE });
    const plan = createDashboardQueryPlan(deps.search, initialToday);
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
  errorComponent: HistoryErrorBoundary,
  component: DashboardRoute,
});

function DashboardRoute() {
  const search = Route.useSearch();
  const { initialToday } = Route.useLoaderData();
  return <Dashboard search={search} initialToday={initialToday} />;
}
