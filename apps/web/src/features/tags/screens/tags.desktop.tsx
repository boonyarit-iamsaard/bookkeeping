import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { byName, EmptyTags } from "@/features/tags/components/tag-list";
import { TagManagement } from "@/features/tags/components/tag-management";
import { TagTable } from "@/features/tags/components/tag-table";
import type { TagSummary } from "@/features/tags/tag-search";
import { TableCard } from "@/shared/components/dashboard-card";
import { TableCardSkeleton } from "@/shared/components/skeleton";

interface TagsDesktopProps {
  tags: readonly TagSummary[];
}

/** One table, half the page wide. */
export function TagsDesktop({ tags }: Readonly<TagsDesktopProps>) {
  return (
    <Page layout="wide">
      <TagManagement>
        {(onDone) =>
          tags.length === 0 ? (
            <div className="w-1/2">
              <EmptyTags />
            </div>
          ) : (
            <TableCard className="w-1/2">
              <TagTable tags={byName(tags)} onDone={onDone} />
            </TableCard>
          )
        }
      </TagManagement>
    </Page>
  );
}

/** The desktop Tags page in neutral blocks: a table's card, half the width. */
export function TagsDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Tags" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <TableCardSkeleton rows={4} className="w-1/2" />
      </div>
    </Page>
  );
}
