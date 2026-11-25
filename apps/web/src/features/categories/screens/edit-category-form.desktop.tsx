"use client";

import {
  CategoryFieldsSection,
  CategoryRemovalSection,
} from "@/features/categories/components/edit-category-form-sections";
import type { EditCategoryFormProps } from "@/features/categories/hooks/use-edit-category-entry-form";
import { useEditCategoryEntryForm } from "@/features/categories/hooks/use-edit-category-entry-form";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Button } from "@/shared/components/ui/button";

/**
 * The dialog behind a category row from 1024px: the fields and the removal
 * scroll, and Cancel and Save stay pinned at the foot. Enter saves.
 */
export function EditCategoryFormDesktop(
  props: Readonly<EditCategoryFormProps>,
) {
  const entryForm = useEditCategoryEntryForm(props);
  const { form, serverError, pending, submit } = entryForm;

  return (
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-6 overflow-y-auto border-t px-6 py-6 *:shrink-0">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <CategoryFieldsSection entryForm={entryForm} />
        <CategoryRemovalSection entryForm={entryForm} />
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t px-6 pt-4 pb-6">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="lg" disabled={isSubmitting || pending}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form.Subscribe>
      </footer>
    </form>
  );
}
