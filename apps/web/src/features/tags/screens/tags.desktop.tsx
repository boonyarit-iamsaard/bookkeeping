import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { byName, EmptyTags } from "@/features/tags/components/tag-list";
import { TagTable } from "@/features/tags/components/tag-table";
import { useTagManagement } from "@/features/tags/hooks/use-tag-management";
import type { TagSummary } from "@/features/tags/tag-search";
import { TableCard } from "@/shared/components/dashboard-card";
import { SavedNotice } from "@/shared/components/saved-notice";
import { TableCardSkeleton } from "@/shared/components/skeleton";
import { cn } from "@/shared/helpers/cn";

interface TagsDesktopProps {
  tags: readonly TagSummary[];
}

/** One table, half the page wide. */
export function TagsDesktop({ tags }: Readonly<TagsDesktopProps>) {
  const { notice, finish } = useTagManagement();
  return (
    <Page layout="wide">
      <TitleBar title="Tags" />
      <SavedNotice
        takeFocusOn={notice.takesFocus ? notice : undefined}
        className={cn(!notice.message && "sr-only")}
      >
        {notice.message}
      </SavedNotice>
      {tags.length === 0 ? (
        <div className="w-1/2">
          <EmptyTags />
        </div>
      ) : (
        <TableCard className="w-1/2">
          <TagTable tags={byName(tags)} onDone={finish} />
        </TableCard>
      )}
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
