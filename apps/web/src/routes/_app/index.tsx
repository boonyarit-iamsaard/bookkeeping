import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/features/home/components/home";
import { HomeErrorBoundary } from "@/features/home/components/home-error-boundary";
import { HomeLoading } from "@/features/home/components/home-loading";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { historySearchSchema } from "@/features/transactions/history-schema";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Home" }] }),
  validateSearch: historySearchSchema.pick({ created: true }),
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
  errorComponent: HomeErrorBoundary,
  component: HomeRoute,
});

function HomeRoute() {
  const { initialToday } = Route.useLoaderData();
  const { created } = Route.useSearch();
  return <Home initialToday={initialToday} savedId={created} />;
}
