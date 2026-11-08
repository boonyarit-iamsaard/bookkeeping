"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Hash } from "lucide-react";
import { useRef, useState } from "react";
import { TitleBar } from "@/core/shell/title-bar";
import { EditTagForm } from "@/features/tags/components/edit-tag-form";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { tagUsageLabel } from "@/features/tags/tag-search";
import { EmptyState } from "@/shared/components/empty-state";
import { listCardClass } from "@/shared/components/list-section";
import { SavedNotice } from "@/shared/components/saved-notice";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/helpers/cn";

interface TagManagementProps {
  tags: readonly TagSummary[];
}

/** Alphabetical here, where tags are looked up by name, not by recency. */
function byName(tags: readonly TagSummary[]): TagSummary[] {
  return tags.toSorted((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/**
 * Every tag on one list card, each row a button to its edit sheet. The
 * list is server truth; every change re-reads it and says what happened
 * in the notice beneath the title.
 */
export function TagManagement({ tags }: Readonly<TagManagementProps>) {
  const [notice, setNotice] = useState("");
  const noticeRef = useRef<HTMLOutputElement>(null);

  function finish(tag: Readonly<TagSummary>, outcome: EditTagOutcome) {
    if (outcome.operation === "rename") {
      setNotice(
        outcome.merged
          ? `${tag.name} merged into ${outcome.tag.name}.`
          : `${tag.name} is now ${outcome.tag.name}.`,
      );
    } else {
      setNotice(
        tag.transactionCount === 0
          ? `${tag.name} deleted.`
          : `${tag.name} deleted and taken off its ${tagUsageLabel(tag.transactionCount)}.`,
      );
    }
    // A merged or deleted row is gone; the announcement takes its focus.
    if (outcome.operation === "delete" || outcome.merged) {
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <TitleBar title="Tags" />

      <SavedNotice
        ref={noticeRef}
        tabIndex={-1}
        className={cn(!notice && "sr-only")}
      >
        {notice}
      </SavedNotice>

      {tags.length === 0 ? (
        <EmptyState
          icon={Hash}
          headingId="empty-tags-heading"
          title="No tags yet"
          description="Tags name what recurs across transactions without being a category, like a shop or a game. Add them from the Tags field when you record income or an expense."
        />
      ) : (
        <ul aria-label="Tags" className={listCardClass}>
          {byName(tags).map((tag) => (
            <li key={tag.id}>
              <TagRow
                tag={tag}
                others={tags.filter((other) => other.id !== tag.id)}
                onDone={(outcome) => finish(tag, outcome)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TagRowProps {
  tag: TagSummary;
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
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
      <SheetPortal className="sm:h-auto sm:max-h-144">
        <SheetHeader subtitle={tag.name}>Edit tag</SheetHeader>
        <EditTagForm
          tag={tag}
          others={others}
          onDone={(outcome) => {
            setOpen(false);
            onDone(outcome);
          }}
          onCancel={() => setOpen(false)}
        />
      </SheetPortal>
    </Dialog.Root>
  );
}
