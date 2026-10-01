import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HOME_COLUMNS_CLASS } from "@/features/home/components/home";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";

/** Home's layout in neutral blocks: never a figure that could pass for money. */
export function HomeLoading() {
  return (
    <Page layout="dashboard">
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className={HOME_COLUMNS_CLASS}>
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* The hero's own Midnight card, with its blocks in a faint hero tint. */}
          <div className="flex min-h-44 flex-col gap-3 rounded-3xl bg-hero p-5 pt-6 shadow-hero sm:min-h-48 sm:p-7">
            <Skeleton className="h-4 w-24 bg-hero-foreground/12" />
            <Skeleton className="mt-auto h-9 w-52 bg-hero-foreground/12 sm:h-12 sm:w-72" />
            <Skeleton className="h-4 w-28 bg-hero-foreground/12" />
          </div>
          <div className="flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card sm:p-6">
            <Skeleton className="h-5 w-24" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <Skeleton className="h-6" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="ml-1 h-6 w-48" />
          <div className={listCardClass}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
