import { cn } from "@/shared/helpers/cn";

// Wide carries lists, details and reports; narrow, a single record's
// management; entry is narrow with room beneath the fields for the phone's
// fixed Save bar. Dashboard is wide until 1024px, then spans the header's
// width for a two-column overview.
const PAGE_LAYOUTS = {
  dashboard: "max-w-2xl pb-8 lg:max-w-5xl lg:px-6",
  wide: "max-w-2xl pb-8",
  narrow: "max-w-md pb-8",
  entry: "max-w-md pb-40 sm:pb-12",
} as const;

interface PageProps {
  layout: keyof typeof PAGE_LAYOUTS;
  /** A screen waiting on its records: busy, and named without naming a screen. */
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * A screen's column. On phone the title bar is the top of the page, so the
 * column starts flush; from 640px the header sits above it and it steps down.
 * Blocks are 24px apart on phone and 32px from 640px.
 */
export function Page({ layout, loading, children }: Readonly<PageProps>) {
  return (
    <main
      aria-busy={loading || undefined}
      aria-label={loading ? "Loading" : undefined}
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 sm:gap-8 sm:pt-8",
        PAGE_LAYOUTS[layout],
      )}
    >
      {children}
    </main>
  );
}
