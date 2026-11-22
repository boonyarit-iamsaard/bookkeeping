import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function TableCardSkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  );
}

/** Categories' layout in neutral blocks: two tables on desktop, a list on phone. */
export function CategoriesLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="dashboard" loading>
      <TitleBar title="Categories" />
      <output className="sr-only">Loading your categories…</output>
      <div aria-hidden="true" className="contents">
        {desktop ? (
          <DashboardRow className="lg:grid-cols-2">
            <TableCardSkeleton />
            <TableCardSkeleton />
          </DashboardRow>
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
