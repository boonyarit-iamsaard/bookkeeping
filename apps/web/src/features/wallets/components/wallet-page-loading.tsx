import { Page } from "@/core/shell/page";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
  TableCardSkeleton,
} from "@/shared/components/skeleton";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function DesktopSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-14 w-56" />
      </div>
      <TableCardSkeleton rows={5} />
    </>
  );
}

function PhoneSkeleton() {
  return (
    <>
      <Skeleton className="mt-4 h-8 w-48 sm:mt-0" />
      <HeroSkeleton captionClassName="w-24" />
      <div className="flex flex-col gap-3">
        <Skeleton className="ml-1 h-6 w-40" />
        <div className={listCardClass}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </>
  );
}

/**
 * A wallet's page in neutral blocks: its unknown name, the balance, then
 * the records. It never shows a figure that could pass for money.
 */
export function WalletPageLoading() {
  const desktop = useIsDesktop();
  return (
    <Page layout="dashboard" loading>
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        {desktop ? <DesktopSkeleton /> : <PhoneSkeleton />}
      </div>
    </Page>
  );
}
