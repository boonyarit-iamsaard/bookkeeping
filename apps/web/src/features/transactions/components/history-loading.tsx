import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

/**
 * The loading shape every transaction route shares, in neutral blocks: a
 * title, then a list. It names no screen, because edit and refund
 * pages wait behind it too, and it never shows a figure that could pass for
 * money.
 */
export function HistoryLoading() {
  return (
    <Page layout="wide" loading>
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

/** The table's stand-in from 1024px: a card of rows under the filter bar, with no figure. */
export function TableSkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-6">
      <Skeleton className="h-6 w-40" />
      {["first", "second", "third", "fourth", "fifth"].map((row) => (
        <Skeleton key={row} className="h-10" />
      ))}
    </div>
  );
}

/**
 * The transaction list's loading shape: the title, then the phone's list or,
 * from 1024px, the filter bar over a table.
 */
export function TransactionsLoading() {
  const desktop = useIsDesktop();
  if (!desktop) {
    return <HistoryLoading />;
  }
  return (
    <Page layout="dashboard" loading>
      <TitleBar title="Transactions" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <Skeleton className="h-16" />
        <TableSkeleton />
      </div>
    </Page>
  );
}

/** A transaction's detail in neutral blocks: the hero, then its fact rows. */
export function TransactionDetailLoading() {
  return (
    <Page layout="wide" loading>
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        <Skeleton className="mt-4 h-8 w-48 sm:mt-0" />
        <HeroSkeleton />
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
