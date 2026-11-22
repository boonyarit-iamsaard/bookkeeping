import type { CategorySummary } from "@bookkeeping/domain/categories";
import type { CategoryColor } from "@/features/categories/category-color";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import type { RemovalContext } from "@/features/categories/components/edit-category-form";
import { EditCategoryForm } from "@/features/categories/components/edit-category-form";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

/** What a sheet finished with, and the row it belonged to. */
export interface EditResult {
  category: CategorySummary;
  removal: RemovalContext;
  outcome: ManageCategoryOutcome;
}

interface EditCategorySheetProps {
  category: CategorySummary;
  color: CategoryColor;
  removal: RemovalContext;
  onDone: (result: Readonly<EditResult>) => void;
  onCancel: () => void;
}

/** The edit sheet a category row opens, shared by the list and the table. */
export function EditCategorySheet({
  category,
  color,
  removal,
  onDone,
  onCancel,
}: Readonly<EditCategorySheetProps>) {
  const kind = CATEGORY_KIND_LABELS[category.kind];
  return (
    <SheetPortal className="sm:h-auto sm:max-h-144">
      <SheetHeader
        subtitle={
          removal.parentName
            ? `${kind} · ${removal.parentName} › ${category.name}`
            : `${kind} · ${category.name}`
        }
      >
        Edit category
      </SheetHeader>
      <EditCategoryForm
        category={category}
        color={color}
        removal={removal}
        onDone={(outcome) => onDone({ category, removal, outcome })}
        onCancel={onCancel}
      />
    </SheetPortal>
  );
}
