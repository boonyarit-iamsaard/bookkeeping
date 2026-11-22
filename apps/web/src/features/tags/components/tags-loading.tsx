import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

/** Tags' layout in neutral blocks: one half-width table on desktop, a list on phone. */
export function TagsLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="dashboard" loading>
      <TitleBar title="Tags" />
      <output className="sr-only">Loading your tags…</output>
      <div aria-hidden="true" className="contents">
        {desktop ? (
          <div className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-6 lg:w-1/2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className={listCardClass}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        )}
      </div>
    </Page>
  );
}
