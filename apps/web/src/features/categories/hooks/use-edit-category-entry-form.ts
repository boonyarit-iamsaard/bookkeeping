import type { CategorySummary } from "@bookkeeping/domain/categories";
import { useId, useState } from "react";
import type { CategoryColor } from "@/features/categories/category-color";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import { useEditCategoryForm } from "@/features/categories/hooks/use-edit-category-form";

/** What a removal would do, worked out by the list that knows the tree. */
export interface RemovalContext {
  /** The parent's name for a child; null for a parent. */
  parentName: string | null;
  /** Children under a parent; a parent with any stays. */
  childCount: number;
  /** Current income or expense entries filed here. */
  entries: number;
}

/** What both compositions of the edit category form are given. */
export interface EditCategoryFormProps {
  category: CategorySummary;
  /** The hue the category wears, so the icon choices preview it. */
  color: CategoryColor;
  removal: RemovalContext;
  onDone: (outcome: ManageCategoryOutcome) => void;
  onCancel: () => void;
}

/**
 * Everything the phone and desktop compositions of the edit category form
 * share: the rename, re-icon and removal writes, and the ids tying the
 * fields to their descriptions. They share no layout.
 */
export function useEditCategoryEntryForm({
  category,
  color,
  removal,
  onDone,
}: Readonly<EditCategoryFormProps>) {
  const prefix = useId();
  const [confirming, setConfirming] = useState(false);
  const state = useEditCategoryForm({
    category,
    reassignedEntries: removal.entries,
    onDone,
  });
  return {
    ...state,
    category,
    color,
    removal,
    nameId: `${prefix}-name`,
    iconId: `${prefix}-icon`,
    removeHeadingId: `${prefix}-remove`,
    confirming,
    setConfirming,
    submit: (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void state.form.handleSubmit();
    },
  };
}

export type EditCategoryEntryForm = ReturnType<typeof useEditCategoryEntryForm>;
