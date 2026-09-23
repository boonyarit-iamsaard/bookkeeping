import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/features/home/components/home";
import { HomeLoading } from "@/features/home/components/home-loading";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Home" }] }),
  loader: async ({ context }) => {
    const initialToday = todayIn({ timeZone: APP_TIME_ZONE });
    const plan = createHomeQueryPlan(initialToday);
    await Promise.all([
      context.queryClient.ensureQueryData(plan.wallets),
      context.queryClient.ensureQueryData(plan.monthly),
      context.queryClient.ensureQueryData(plan.recent),
    ]);
    return { initialToday };
  },
  pendingComponent: HomeLoading,
  errorComponent: HistoryErrorBoundary,
  component: HomeRoute,
});

function HomeRoute() {
  const { initialToday } = Route.useLoaderData();
  return <Home initialToday={initialToday} />;
}
