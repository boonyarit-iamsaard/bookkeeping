import { EditTagForm } from "@/features/tags/components/edit-tag-form";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

interface EditTagSheetProps {
  tag: TagSummary;
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
  onCancel: () => void;
}

/** The edit sheet a tag row opens, shared by the list and the table. */
export function EditTagSheet({
  tag,
  others,
  onDone,
  onCancel,
}: Readonly<EditTagSheetProps>) {
  return (
    <SheetPortal className="sm:h-auto sm:max-h-144">
      <SheetHeader subtitle={tag.name}>Edit tag</SheetHeader>
      <EditTagForm
        tag={tag}
        others={others}
        onDone={onDone}
        onCancel={onCancel}
      />
    </SheetPortal>
  );
}
