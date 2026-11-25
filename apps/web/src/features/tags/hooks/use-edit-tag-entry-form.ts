import { useId, useState } from "react";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import { useEditTagForm } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { sameTagName } from "@/features/tags/tag-search";

/** What both compositions of the edit tag form are given. */
export interface EditTagFormProps {
  tag: TagSummary;
  /** The owner's other tags, so a rename onto one says it will merge. */
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
  onCancel: () => void;
}

/**
 * Everything the phone and desktop compositions of the edit tag form share:
 * the rename and delete writes, the merge a rename may become, and the
 * ids tying the fields to their descriptions. They share no layout.
 */
export function useEditTagEntryForm({
  tag,
  others,
  onDone,
}: Readonly<EditTagFormProps>) {
  const prefix = useId();
  const nameId = `${prefix}-name`;
  const [confirming, setConfirming] = useState(false);
  const state = useEditTagForm({ tag, onDone });
  const survivor = others.find((other) => sameTagName(other.name, state.name));
  const nameError = state.nameError;
  return {
    ...state,
    tag,
    nameId,
    deleteHeadingId: `${prefix}-delete`,
    confirming,
    setConfirming,
    survivor,
    unchanged: state.name === tag.name,
    saveLabel: survivor ? "Merge tags" : "Save name",
    describedBy: [
      survivor ? `${nameId}-merge` : `${nameId}-description`,
      nameError ? `${nameId}-error` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
    submit: (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (state.name !== tag.name) {
        void state.save();
      }
    },
  };
}

export type EditTagEntryForm = ReturnType<typeof useEditTagEntryForm>;
