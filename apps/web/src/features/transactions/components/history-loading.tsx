import { Page } from "@/core/shell/page";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";

/**
 * The phone history in neutral blocks: a title, then a month of list rows.
 */
export function HistoryLoading() {
  return (
    <Page layout="column" loading>
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Skeleton className="mt-4 h-8 w-48 sm:mt-0" />
        <div className="flex flex-col gap-3">
          <Skeleton className="ml-1 h-6 w-40" />
          <div className={listCardClass}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
