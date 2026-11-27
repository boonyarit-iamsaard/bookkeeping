import { useMediaQuery } from "@/shared/hooks/use-media-query";

// Tailwind's `lg`: the desktop layout starts where its classes do.
const DESKTOP_QUERY = "(min-width: 64rem)";

/** The same check outside React, for a route's loader. */
export function isDesktopViewport() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * Whether the window is wide enough for the desktop layout, from 1024px. It
 * follows a resize live, so a screen swaps its composition without a reload.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY, false);
}
