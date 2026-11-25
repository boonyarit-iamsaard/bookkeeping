import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute } from "@tanstack/react-router";
import { AccountSheet } from "@/features/auth/components/account-sheet";
import { HomeErrorBoundary } from "@/features/home/components/home-error-boundary";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import {
  HomeDesktop,
  HomeDesktopLoading,
} from "@/features/home/screens/home.desktop";
import {
  HomePhone,
  HomePhoneLoading,
} from "@/features/home/screens/home.phone";
import { historySearchSchema } from "@/features/transactions/history-schema";
import { isDesktopViewport, useIsDesktop } from "@/shared/hooks/use-is-desktop";

function HomeRoute() {
  const { initialToday } = Route.useLoaderData();
  const { created } = Route.useSearch();
  const { session } = Route.useRouteContext();
  return useIsDesktop() ? (
    <HomeDesktop initialToday={initialToday} savedId={created} />
  ) : (
    <HomePhone
      accountControl={<AccountSheet email={session.user.email} />}
      initialToday={initialToday}
      savedId={created}
    />
  );
}

function HomeLoading() {
  return useIsDesktop() ? <HomeDesktopLoading /> : <HomePhoneLoading />;
}

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Home" }] }),
  validateSearch: historySearchSchema.pick({ created: true }),
  loader: async ({ context }) => {
    const initialToday = todayIn({ timeZone: APP_TIME_ZONE });
    const plan = createHomeQueryPlan(initialToday);
    await Promise.all([
      context.queryClient.ensureQueryData(plan.wallets),
      context.queryClient.ensureQueryData(plan.daily),
      context.queryClient.ensureQueryData(plan.monthly),
      context.queryClient.ensureQueryData(plan.recent),
      context.queryClient.ensureQueryData(plan.categories),
      context.queryClient.ensureQueryData(plan.categorySpending),
      // Desktop's cash flow; its six months hold the last, which the tiles compare against.
      ...(isDesktopViewport() ? plan.trend() : []).map((query) =>
        context.queryClient.ensureQueryData(query),
      ),
    ]);
    return { initialToday };
  },
  pendingComponent: HomeLoading,
  errorComponent: HomeErrorBoundary,
  component: HomeRoute,
});
