import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { DashboardRow } from "@/shared/components/dashboard-row";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

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

function BalanceDateSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11" />
    </div>
  );
}

function MonthSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
      <div className="divide-border/70 divide-y">
        <FigureRowSkeleton />
        <FigureRowSkeleton />
        <FigureRowSkeleton />
      </div>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3" />
      <div className="divide-border/70 divide-y">
        <FigureRowSkeleton />
        <FigureRowSkeleton />
      </div>
    </div>
  );
}

function TrendSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-44" />
      <Skeleton className="h-11" />
    </div>
  );
}

function BalancesSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-40" />
      <div className="divide-border/70 -mx-5 divide-y sm:-mx-6">
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}

function BalanceTrendSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-44" />
      <FigureRowSkeleton />
    </div>
  );
}

function PhoneSkeleton() {
  return (
    <>
      <BalanceDateSkeleton />
      <HeroSkeleton captionClassName="w-36" />
      <MonthSkeleton />
      <CategoriesSkeleton />
      <TrendSkeleton />
      <BalancesSkeleton />
      <BalanceTrendSkeleton />
    </>
  );
}

// The ready report's rows, so nothing moves when it arrives.
function DesktopSkeleton() {
  return (
    <>
      <DashboardRow className="lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <HeroSkeleton captionClassName="w-36" />
        <MonthSkeleton />
      </DashboardRow>
      <DashboardRow className="lg:grid-cols-2">
        <CategoriesSkeleton />
        <TrendSkeleton />
      </DashboardRow>
      <DashboardRow className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <BalancesSkeleton />
        <BalanceTrendSkeleton />
      </DashboardRow>
    </>
  );
}

/** Reports' layout in neutral blocks: never a figure that could pass for money. */
export function ReportsLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="dashboard" loading>
      <TitleBar
        title="Reports"
        actions={
          <div aria-hidden="true" className="bg-muted h-11 w-44 rounded-lg" />
        }
      />
      <output className="text-muted-foreground text-sm">
        Loading your report…
      </output>
      <div
        aria-hidden="true"
        className={desktop ? "contents" : "flex flex-col gap-6 sm:gap-8"}
      >
        {desktop ? <DesktopSkeleton /> : <PhoneSkeleton />}
      </div>
    </Page>
  );
}
