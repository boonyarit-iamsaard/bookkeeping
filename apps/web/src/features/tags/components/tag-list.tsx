"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Hash } from "lucide-react";
import { useState } from "react";
import { EditTagSheet } from "@/features/tags/components/edit-tag-sheet";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { tagUsageLabel } from "@/features/tags/tag-search";
import { EmptyState } from "@/shared/components/empty-state";
import { listCardClass } from "@/shared/components/list-section";

interface TagListProps {
  tags: readonly TagSummary[];
  onDone: (tag: Readonly<TagSummary>, outcome: EditTagOutcome) => void;
}

interface TagRowProps {
  tag: TagSummary;
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
}

/** Alphabetical here, where tags are looked up by name, not by recency. */
export function byName(tags: readonly TagSummary[]): TagSummary[] {
  return tags.toSorted((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

export function EmptyTags() {
  return (
    <EmptyState
      icon={Hash}
      headingId="empty-tags-heading"
      title="No tags yet"
      description="Tags name what recurs across transactions without being a category, like a shop or a game. Add them from the Tags field when you record income or an expense."
    />
  );
}

/** One row, and the sheet it opens; focus comes back here on close. */
function TagRow({ tag, others, onDone }: Readonly<TagRowProps>) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-tag-row={tag.id}
        className="group/row hover:bg-accent/70 focus-visible:ring-ring/45 active:bg-accent flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-inset motion-reduce:transition-none"
      >
        <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-lg">
          <Hash aria-hidden="true" strokeWidth={2} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="leading-snug font-semibold wrap-break-word">
            {tag.name}
          </span>
          <span className="text-muted-foreground text-sm">
            {tagUsageLabel(tag.transactionCount)}
          </span>
        </span>
      </Dialog.Trigger>
      <EditTagSheet
        tag={tag}
        others={others}
        onDone={(outcome) => {
          setOpen(false);
          onDone(outcome);
        }}
        onCancel={() => setOpen(false)}
      />
    </Dialog.Root>
  );
}

/** Every tag on one list card, in the order given, each row a button to its edit sheet. */
export function TagList({ tags, onDone }: Readonly<TagListProps>) {
  return (
    <ul aria-label="Tags" className={listCardClass}>
      {tags.map((tag) => (
        <li key={tag.id}>
          <TagRow
            tag={tag}
            others={tags.filter((other) => other.id !== tag.id)}
            onDone={(outcome) => onDone(tag, outcome)}
          />
        </li>
      ))}
    </ul>
  );
}
