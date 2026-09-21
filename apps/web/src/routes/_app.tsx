import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { readSession } from "@/core/auth/session";
import { AppHeader } from "@/core/shell/app-header";
import { AccountMenu } from "@/features/auth/components/account-menu";

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

  return (
    <>
      <AppHeader accountMenu={<AccountMenu email={session.user.email} />} />
      <Outlet />
    </>
  );
}
