import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
  TableCardSkeleton,
} from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function SummarySkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col gap-5 rounded-2xl p-5 sm:p-6">
      <Skeleton className="h-5 w-24" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      <Skeleton className="h-6" />
      <Skeleton className="h-24" />
    </div>
  );
}

function PhoneSkeleton() {
  return (
    <>
      <HeroSkeleton />
      <SummarySkeleton />
      <div className="flex flex-col gap-3">
        <Skeleton className="ml-1 h-6 w-48" />
        <div className={listCardClass}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </>
  );
}

function DesktopSkeleton() {
  return (
    <>
      <DashboardRow className="lg:grid-cols-3">
        <HeroSkeleton />
        <SummarySkeleton />
        <SummarySkeleton />
      </DashboardRow>
      <DashboardRow className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <TableCardSkeleton />
        <TableCardSkeleton />
      </DashboardRow>
      <TableCardSkeleton />
    </>
  );
}

/** Home's layout in neutral blocks: never a figure that could pass for money. */
export function HomeLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="wide" loading>
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        {desktop ? <DesktopSkeleton /> : <PhoneSkeleton />}
      </div>
    </Page>
  );
}
