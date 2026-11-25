import type { CategorySummary } from "@bookkeeping/domain/categories";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import type {
  EditCategoryFormProps,
  RemovalContext,
} from "@/features/categories/hooks/use-edit-category-entry-form";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

/** What a sheet finished with, and the row it belonged to. */
export interface EditResult {
  category: CategorySummary;
  removal: RemovalContext;
  outcome: ManageCategoryOutcome;
}

interface EditCategorySheetProps extends Omit<EditCategoryFormProps, "onDone"> {
  onDone: (result: Readonly<EditResult>) => void;
  /** The composition to edit with; the list or the table picks it. */
  formComponent: React.ComponentType<EditCategoryFormProps>;
}

/** The edit sheet a category row opens, shared by the list and the table. */
export function EditCategorySheet({
  formComponent: Form,
  onDone,
  ...form
}: Readonly<EditCategorySheetProps>) {
  const { category, removal } = form;
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
      <Form
        {...form}
        onDone={(outcome) => onDone({ category, removal, outcome })}
      />
    </SheetPortal>
  );
}
