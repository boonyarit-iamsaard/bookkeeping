import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import {
  pageTransitionTypes,
  supportsPageTransitions,
} from "@/core/router/page-transition";
import { NotFound } from "@/core/shell/not-found";
import { isScreenLoading } from "@/core/shell/page";
import { RootErrorBoundary } from "@/core/shell/root-error-boundary";
import { routeTree } from "@/routeTree.gen";

/** What every route's `beforeLoad` and loader can reach. */
export interface RouterContext {
  queryClient: QueryClient;
}

export function createAppRouter(context: Readonly<RouterContext>) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RootErrorBoundary,
    // Keyed by address rather than history entry, so returning to a tab by
    // its link finds the place it was left.
    scrollRestoration: true,
    getScrollRestorationKey: (location) => location.href,
    // Without view transition types the browser would crossfade every
    // change, search changes and reduced motion included, so it gets none.
    defaultViewTransition: supportsPageTransitions() && {
      types: ({ fromLocation, toLocation }) =>
        pageTransitionTypes({
          fromPathname: fromLocation?.pathname,
          toPathname: toLocation.pathname,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          loading: isScreenLoading(),
        }),
    },
  });
}

type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

/** Whether a pathname reaches a signed-in screen rather than not-found or sign-in. */
export function isSignedInPathname(
  router: Readonly<Pick<AppRouter, "getMatchedRoutes">>,
  pathname: string,
): boolean {
  const [matchedRoutes, rawParams, foundRoute] =
    router.getMatchedRoutes(pathname);
  return (
    foundRoute !== undefined &&
    rawParams["**"] === undefined &&
    matchedRoutes.some((route) => route.id === "/_app")
  );
}
