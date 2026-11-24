import { useEffect, useState } from "react";
import { cn } from "@/shared/helpers/cn";

// Below 1024px every screen shares the 672px column, so navigating never
// changes its width; forms narrow their fields inside it. Entry adds room
// beneath the fields for the phone's fixed Save bar. Wide opens from 1024px
// to the shell's 96rem content column.
const PAGE_LAYOUTS = {
  column: "pb-8",
  wide: "pb-8 lg:max-w-384 lg:px-8",
  entry: "pb-56 sm:pb-12",
} as const;

interface PageProps {
  layout: keyof typeof PAGE_LAYOUTS;
  /** A screen waiting on its records: busy, and named without naming a screen. */
  loading?: boolean;
  children: React.ReactNode;
}

// True while a screen's skeleton is mounted, so the content that replaces it
// in place crossfades in rather than snapping.
let skeletonMounted = false;

/** Whether the screen on show is still a skeleton waiting on its records. */
export function isScreenLoading() {
  return document.querySelector("main[aria-busy='true']") !== null;
}

function useSkeletonCrossfade(loading: boolean | undefined) {
  const [replacesSkeleton] = useState(() => !loading && skeletonMounted);
  useEffect(() => {
    if (!loading) {
      return;
    }
    skeletonMounted = true;
    return () => {
      skeletonMounted = false;
    };
  }, [loading]);
  return replacesSkeleton;
}

/**
 * A screen's column. On phone the title bar is the top of the page, so the
 * column starts flush; from 640px the header sits above it and it steps down.
 * Blocks are 24px apart on phone and 32px from 640px.
 */
export function Page({ layout, loading, children }: Readonly<PageProps>) {
  const crossfade = useSkeletonCrossfade(loading);
  return (
    <main
      aria-busy={loading || undefined}
      aria-label={loading ? "Loading" : undefined}
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 sm:gap-8 lg:pt-8",
        PAGE_LAYOUTS[layout],
        crossfade &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 motion-safe:ease-out",
      )}
    >
      {children}
    </main>
  );
}
