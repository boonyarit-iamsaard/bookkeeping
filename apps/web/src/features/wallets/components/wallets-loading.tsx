import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { TableCardSkeleton } from "@/shared/components/skeleton";

/** The Wallets list in neutral blocks: never a figure that could pass for money. */
export function WalletsLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Wallets" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <TableCardSkeleton />
      </div>
    </Page>
  );
}
