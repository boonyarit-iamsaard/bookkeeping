import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { TableCardSkeleton } from "@/shared/components/skeleton";

/** Categories' layout in neutral blocks: a table's card for each tree. */
export function CategoriesLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Categories" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <DashboardRow className="lg:grid-cols-2">
          <TableCardSkeleton rows={4} />
          <TableCardSkeleton rows={4} className="max-lg:hidden" />
        </DashboardRow>
      </div>
    </Page>
  );
}
