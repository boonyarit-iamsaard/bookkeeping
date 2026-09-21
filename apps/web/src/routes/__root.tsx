import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import type { RouterContext } from "@/core/router/router";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: "Bookkeeping" }] }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
