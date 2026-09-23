import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="h-5 w-28 rounded bg-muted" />
    </div>
  );
}

/** Reports' layout in neutral blocks: never a figure that could pass for money. */
export function ReportsLoading() {
  return (
    <Page layout="wide">
      <TitleBar
        title="Reports"
        actions={
          <div aria-hidden="true" className="h-11 w-44 rounded-4xl bg-muted" />
        }
      />
      <output className="text-muted-foreground text-sm">
        Loading your report…
      </output>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 border-y py-5">
          <div className="flex flex-col gap-2 sm:w-1/2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-11 rounded-4xl bg-muted" />
          </div>
          <div className="h-11 w-36 rounded-4xl bg-muted" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="divide-y">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-6 w-36 rounded bg-muted" />
          <div className="divide-y">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
