"use client";

import { useState } from "react";
import { TitleBar } from "@/core/shell/title-bar";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { tagUsageLabel } from "@/features/tags/tag-search";
import { SavedNotice } from "@/shared/components/saved-notice";
import { cn } from "@/shared/helpers/cn";

interface TagManagementProps {
  /** The tags, in the composition's own layout; each edit reports to `onDone`. */
  children: (
    onDone: (tag: Readonly<TagSummary>, outcome: EditTagOutcome) => void,
  ) => React.ReactNode;
}

/**
 * The title, then the notice saying what the last change did. The tags are
 * server truth; every change re-reads them.
 */
export function TagManagement({ children }: Readonly<TagManagementProps>) {
  const [notice, setNotice] = useState({ message: "", takesFocus: false });

  function finish(tag: Readonly<TagSummary>, outcome: EditTagOutcome) {
    if (outcome.operation === "rename") {
      setNotice({
        message: outcome.merged
          ? `${tag.name} merged into ${outcome.tag.name}.`
          : `${tag.name} is now ${outcome.tag.name}.`,
        // A merged row is gone; the announcement takes its focus.
        takesFocus: outcome.merged,
      });
    } else {
      setNotice({
        message:
          tag.transactionCount === 0
            ? `${tag.name} deleted.`
            : `${tag.name} deleted and taken off its ${tagUsageLabel(tag.transactionCount)}.`,
        // The deleted row is gone; the announcement takes its focus.
        takesFocus: true,
      });
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <TitleBar title="Tags" />

      <SavedNotice
        takeFocusOn={notice.takesFocus ? notice : undefined}
        className={cn(!notice.message && "sr-only")}
      >
        {notice.message}
      </SavedNotice>

      {children(finish)}
    </div>
  );
}
