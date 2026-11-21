import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import type { RouterContext } from "@/core/router/router";

function RootLayout() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: "Bookkeeping" }] }),
  component: RootLayout,
});
