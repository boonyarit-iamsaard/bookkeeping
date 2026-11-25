import type { EditTagFormProps } from "@/features/tags/hooks/use-edit-tag-entry-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { SheetHeader, SheetPortal } from "@/shared/components/ui/sheet";

interface EditTagSheetProps extends Omit<EditTagFormProps, "tag"> {
  tag: TagSummary;
  /** The composition to edit with; the list or the table picks it. */
  formComponent: React.ComponentType<EditTagFormProps>;
}

/** The edit sheet a tag row opens, shared by the list and the table. */
export function EditTagSheet({
  tag,
  formComponent: Form,
  ...form
}: Readonly<EditTagSheetProps>) {
  return (
    <SheetPortal className="sm:h-auto sm:max-h-144">
      <SheetHeader subtitle={tag.name}>Edit tag</SheetHeader>
      <Form tag={tag} {...form} />
    </SheetPortal>
  );
}
