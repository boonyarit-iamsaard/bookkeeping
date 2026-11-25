import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";

export const CARD_CLASS =
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
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11" />
    </div>
  );
}

export function MonthSkeleton() {
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

export function CategoriesSkeleton() {
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

export function TrendSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-44" />
      <Skeleton className="h-11" />
    </div>
  );
}

export function BalancesSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-40" />
      <BalanceDateSkeleton />
      <div className="divide-border/70 -mx-5 divide-y sm:-mx-6">
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}

export function BalanceTrendSkeleton() {
  return (
    <div className={CARD_CLASS}>
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-44" />
      <FigureRowSkeleton />
    </div>
  );
}
