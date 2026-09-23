import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { readSession } from "@/core/auth/session";
import { AppHeader } from "@/core/shell/app-header";
import { useIsFormScreen } from "@/core/shell/form-screen";
import { TabBar } from "@/core/shell/tab-bar";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { captureSearchForLocation } from "@/features/transactions/capture-origin";
import { cn } from "@/shared/helpers/cn";

/**
 * The signed-in half of the app. The cached session is the optimistic check;
 * every API call is still authenticated by the cookie, and a refusal sends
 * the app back through here.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => {
    const session = await readSession(context.queryClient);
    if (!session) {
      throw redirect({ to: "/sign-in" });
    }
    return { session };
  },
  component: AppLayout,
});

function AppLayout() {
  const { session } = Route.useRouteContext();
  const isFormScreen = useIsFormScreen();
  const location = useLocation();
  const captureSearch = captureSearchForLocation({
    pathname: location.pathname,
    searchStr: location.searchStr,
  });

  return (
    <>
      <AppHeader
        accountMenu={<AccountMenu email={session.user.email} />}
        captureSearch={captureSearch}
      />
      {/* On phone the page ends above the tab bar, so nothing hides behind it. */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !isFormScreen &&
            "max-sm:pb-[calc(3.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        <Outlet />
      </div>
      {!isFormScreen && <TabBar captureSearch={captureSearch} />}
    </>
  );
}
