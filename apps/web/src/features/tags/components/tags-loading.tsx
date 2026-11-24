import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { TableCardSkeleton } from "@/shared/components/skeleton";

/** Tags' layout in neutral blocks: a table's card, half the width from 1024px. */
export function TagsLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Tags" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <TableCardSkeleton rows={4} className="lg:w-1/2" />
      </div>
    </Page>
  );
}
