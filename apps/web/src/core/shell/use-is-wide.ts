import { useMediaQuery } from "@/shared/hooks/use-media-query";

/** Whether the window is 1280px or wider, live as it resizes. */
export function useIsWide() {
  // Tailwind's `xl`: from here the expanded sidebar pushes the page; below it,
  // between 1024px and 1280px, it rests on the rail and expands over the page.
  return useMediaQuery("(min-width: 80rem)", true);
}
