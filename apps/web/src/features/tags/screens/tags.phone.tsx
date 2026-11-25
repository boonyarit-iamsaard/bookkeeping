import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  byName,
  EmptyTags,
  TagList,
} from "@/features/tags/components/tag-list";
import { useTagManagement } from "@/features/tags/hooks/use-tag-management";
import type { TagSummary } from "@/features/tags/tag-search";
import { listCardClass } from "@/shared/components/list-section";
import { SavedNotice } from "@/shared/components/saved-notice";
import { RowSkeleton } from "@/shared/components/skeleton";
import { cn } from "@/shared/helpers/cn";

interface TagsPhoneProps {
  tags: readonly TagSummary[];
}

/** Every tag on one list card. */
export function TagsPhone({ tags }: Readonly<TagsPhoneProps>) {
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
        <EmptyTags />
      ) : (
        <TagList tags={byName(tags)} onDone={finish} />
      )}
    </Page>
  );
}

/** The phone Tags page in neutral blocks: one card. */
export function TagsPhoneLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Tags" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <div className={listCardClass}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </Page>
  );
}
