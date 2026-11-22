import { useSyncExternalStore } from "react";

// Tailwind's `lg`: the desktop layout starts where its classes do.
const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function isDesktopViewport() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/**
 * Whether the window is wide enough for the desktop layout, from 1024px. It
 * follows a resize live, so a screen swaps its composition without a reload.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktopViewport, () => false);
}
