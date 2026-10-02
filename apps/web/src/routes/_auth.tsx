import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { readSession } from "@/core/auth/session";
import { AppMark } from "@/core/shell/app-mark";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    if (await readSession(context.queryClient)) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthLayout,
});

/**
 * The signed-out ground: the app mark and wordmark above one Card in the
 * 448px column. There is no shell, so nothing else competes with the form.
 */
function AuthLayout() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-md flex-col gap-6 sm:gap-8">
        <div className="flex items-center justify-center gap-3 font-bold text-[1.0625rem] tracking-tight">
          <AppMark className="size-10" />
          <span>Bookkeeping</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
