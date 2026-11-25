import { useState } from "react";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { tagUsageLabel } from "@/features/tags/tag-search";

export function useTagManagement() {
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

  return { notice, finish };
}
