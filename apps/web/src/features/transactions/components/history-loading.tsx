import { Page } from "@/core/shell/page";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";

/**
 * The loading shape every transaction route shares, in neutral blocks: a
 * title, then a list. It names no screen, because edit, refund and wallet
 * pages wait behind it too, and it never shows a figure that could pass for
 * money.
 */
export function HistoryLoading() {
  return (
    <Page layout="wide">
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

/** A transaction's detail in neutral blocks: the hero, then its fact rows. */
export function TransactionDetailLoading() {
  return (
    <Page layout="wide">
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        <Skeleton className="mt-4 h-8 w-48 sm:mt-0" />
        <div className="flex min-h-44 flex-col gap-3 rounded-3xl bg-hero p-5 pt-6 shadow-hero sm:min-h-48 sm:p-7">
          <Skeleton className="h-4 w-24 bg-hero-foreground/12" />
          <Skeleton className="mt-auto h-9 w-52 bg-hero-foreground/12 sm:h-12 sm:w-72" />
          <Skeleton className="h-4 w-28 bg-hero-foreground/12" />
        </div>
        <div className={listCardClass}>
          {["category", "wallet", "date", "note", "recorded"].map((row) => (
            <div key={row} className="flex min-h-16 flex-col gap-2 px-5 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
