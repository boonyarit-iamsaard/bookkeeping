import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  byName,
  EmptyTags,
  TagList,
} from "@/features/tags/components/tag-list";
import { TagManagement } from "@/features/tags/components/tag-management";
import type { TagSummary } from "@/features/tags/tag-search";
import { TableCardSkeleton } from "@/shared/components/skeleton";

interface TagsPhoneProps {
  tags: readonly TagSummary[];
}

/** Every tag on one list card. */
export function TagsPhone({ tags }: Readonly<TagsPhoneProps>) {
  return (
    <Page layout="wide">
      <TagManagement>
        {(onDone) =>
          tags.length === 0 ? (
            <EmptyTags />
          ) : (
            <TagList tags={byName(tags)} onDone={onDone} />
          )
        }
      </TagManagement>
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
        <TableCardSkeleton rows={4} />
      </div>
    </Page>
  );
}
