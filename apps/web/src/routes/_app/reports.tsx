import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { ReportErrorBoundary } from "@/features/reports/components/report-error-boundary";
import { Reports } from "@/features/reports/components/reports";
import { ReportsLoading } from "@/features/reports/components/reports-loading";
import { preloadReports } from "@/features/reports/report-reads";
import { reportSearchSchema } from "@/features/reports/report-schema";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports" }] }),
  validateSearch: reportSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const initialToday = todayIn({ timeZone: APP_TIME_ZONE });
    await preloadReports({
      queryClient: context.queryClient,
      search: deps.search,
      today: initialToday,
    });
    return { initialToday };
  },
  pendingComponent: ReportsLoading,
  errorComponent: ReportErrorBoundary,
  component: ReportsRoute,
});

function ReportsRoute() {
  const search = Route.useSearch();
  const { initialToday } = Route.useLoaderData();
  return <Reports search={search} initialToday={initialToday} />;
}
