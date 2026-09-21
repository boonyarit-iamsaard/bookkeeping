import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

/** What every route's `beforeLoad` and loader can reach. */
export interface RouterContext {
  queryClient: QueryClient;
}

export function createAppRouter(context: Readonly<RouterContext>) {
  return createRouter({ routeTree, context, defaultPreload: "intent" });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
