import { useSyncExternalStore } from "react";

// Tailwind's `xl`: from here the expanded sidebar pushes the page; below it,
// between 1024px and 1280px, it rests on the rail and expands over the page.
const WIDE_QUERY = "(min-width: 80rem)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the window is 1280px or wider, live as it resizes. */
export function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}
