import type { ReactNode } from "react";

interface PastLastPageProps {
  page: number;
  lastPage: number;
  /** The way back, as the screen's own link. */
  children: ReactNode;
}

/** An old link to a page the list no longer reaches. */
export function PastLastPage({
  page,
  lastPage,
  children,
}: Readonly<PastLastPageProps>) {
  return (
    <section
      className="bg-card shadow-card flex flex-col items-start gap-3 rounded-2xl p-5 sm:p-7"
      aria-labelledby="past-last-heading"
    >
      <h2 id="past-last-heading" className="text-lg font-bold tracking-tight">
        Page {page} is past the end
      </h2>
      <p className="text-muted-foreground max-w-prose text-sm leading-normal">
        This list has {lastPage} {lastPage === 1 ? "page" : "pages"}.
      </p>
      {children}
    </section>
  );
}
