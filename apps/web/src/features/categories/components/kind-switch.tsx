import type { CategoryKind } from "@bookkeeping/domain/categories";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";

// Expense first: it is the tree that gets customized.
export const KIND_OPTIONS = (
  ["expense", "income"] as const satisfies readonly CategoryKind[]
).map((value) => ({ value, label: CATEGORY_KIND_LABELS[value] }));

interface KindSwitchProps {
  kind: CategoryKind;
  onChange: (kind: CategoryKind) => void;
}

/** Expense or Income: the phone's tree switch, and the desktop sheet's choice of tree. */
export function KindSwitch({ kind, onChange }: Readonly<KindSwitchProps>) {
  return (
    <div>
      <span id="category-tree-label" className="sr-only">
        Category tree
      </span>
      <SegmentedControl
        aria-labelledby="category-tree-label"
        options={KIND_OPTIONS}
        value={kind}
        onValueChange={onChange}
      />
    </div>
  );
}
