import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, live as the window resizes. `serverValue`
 * is the answer before there is a window.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  // Stable per query, so a re-render never resubscribes.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
