import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { listCardClass } from "@/shared/components/list-section";
import { RowSkeleton, Skeleton } from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

/** The Wallets list in neutral blocks: never a figure that could pass for money. */
export function WalletsLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="dashboard" loading>
      <TitleBar title="Wallets" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        {desktop ? (
          <div className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-6">
            <Skeleton className="h-6 w-48" />
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
