import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-5 w-28 rounded bg-muted" />
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="flex min-h-16 items-center gap-4 py-3">
      <div className="size-10 shrink-0 rounded-full bg-muted" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="h-5 w-24 rounded bg-muted" />
    </div>
  );
}

/** Home's layout in neutral blocks: never a figure that could pass for money. */
export function HomeLoading() {
  return (
    <Page layout="wide">
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="h-10 w-56 rounded bg-muted sm:h-12" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="mt-3 h-6 w-28 rounded bg-muted" />
          <div className="divide-y">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="divide-y">
            <TransactionSkeleton />
            <TransactionSkeleton />
            <TransactionSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
