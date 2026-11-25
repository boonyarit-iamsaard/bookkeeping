import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { ReportErrorBoundary } from "@/features/reports/components/report-error-boundary";
import { preloadReports } from "@/features/reports/report-reads";
import { reportSearchSchema } from "@/features/reports/report-schema";
import {
  ReportsDesktop,
  ReportsDesktopLoading,
} from "@/features/reports/screens/reports.desktop";
import {
  ReportsPhone,
  ReportsPhoneLoading,
} from "@/features/reports/screens/reports.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function ReportsRoute() {
  const search = Route.useSearch();
  const { initialToday } = Route.useLoaderData();
  return useIsDesktop() ? (
    <ReportsDesktop search={search} initialToday={initialToday} />
  ) : (
    <ReportsPhone search={search} initialToday={initialToday} />
  );
}

function ReportsLoading() {
  return useIsDesktop() ? <ReportsDesktopLoading /> : <ReportsPhoneLoading />;
}

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
