import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HOME_COLUMNS_CLASS } from "@/features/home/components/home";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";

/** Home's layout in neutral blocks: never a figure that could pass for money. */
export function HomeLoading() {
  return (
    <Page layout="dashboard" loading>
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className={HOME_COLUMNS_CLASS}>
        <div className="flex flex-col gap-6 sm:gap-8">
          <HeroSkeleton />
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
