import { cn } from "@/shared/helpers/cn";

// Wide carries lists, details and reports; narrow, a single record's
// management; entry is narrow with room beneath the fields for the phone's
// fixed Save bar.
const PAGE_LAYOUTS = {
  wide: "max-w-2xl pb-8",
  narrow: "max-w-md pb-8",
  entry: "max-w-md pb-40 sm:pb-12",
} as const;

interface PageProps {
  layout: keyof typeof PAGE_LAYOUTS;
  children: React.ReactNode;
}

/**
 * A screen's column. On phone the title bar is the top of the page, so the
 * column starts flush; from 640px the header sits above it and it steps down.
 */
export function Page({ layout, children }: Readonly<PageProps>) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full flex-col gap-8 px-4 sm:pt-8",
        PAGE_LAYOUTS[layout],
      )}
    >
      {children}
    </main>
  );
}
