import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";

const CARD_CLASS =
  "flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card sm:p-6";

function FigureRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-28" />
    </div>
  );
}

/** Reports' layout in neutral blocks: never a figure that could pass for money. */
export function ReportsLoading() {
  return (
    <Page layout="wide">
      <TitleBar
        title="Reports"
        actions={
          <div aria-hidden="true" className="h-11 w-44 rounded-lg bg-muted" />
        }
      />
      <output className="text-muted-foreground text-sm">
        Loading your report…
      </output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        <div className={CARD_CLASS}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11" />
        </div>
        <div className="flex min-h-44 flex-col gap-3 rounded-3xl bg-hero p-5 pt-6 shadow-hero sm:min-h-48 sm:p-7">
          <Skeleton className="h-4 w-24 bg-hero-foreground/12" />
          <Skeleton className="mt-auto h-9 w-52 bg-hero-foreground/12 sm:h-12 sm:w-72" />
          <Skeleton className="h-4 w-36 bg-hero-foreground/12" />
        </div>
        <div className={CARD_CLASS}>
          <Skeleton className="h-6 w-40" />
          <div className="flex flex-col gap-3.5">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
          <div className="divide-y divide-border/70">
            <FigureRowSkeleton />
            <FigureRowSkeleton />
            <FigureRowSkeleton />
          </div>
        </div>
        <div className={CARD_CLASS}>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-44" />
          <Skeleton className="h-11" />
        </div>
        <div className={CARD_CLASS}>
          <Skeleton className="h-6 w-40" />
          <div className="-mx-5 divide-y divide-border/70 sm:-mx-6">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
