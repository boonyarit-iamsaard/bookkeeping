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
 * The sheet behind a category row below 1024px: rename and re-icon in one
 * save across the sheet, and beneath a hairline, the removal. Its own form
 * element, so Enter in the name saves and never reaches anything behind it.
 */
export function EditCategoryFormPhone(props: Readonly<EditCategoryFormProps>) {
  const entryForm = useEditCategoryEntryForm(props);
  const { form, serverError, pending, submit } = entryForm;

  return (
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-1 pb-6 sm:px-6">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <CategoryFieldsSection entryForm={entryForm} />

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || pending}
              className="w-full"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form.Subscribe>

        <CategoryRemovalSection entryForm={entryForm} />
      </div>

      <div className="border-border/70 flex shrink-0 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={props.onCancel}
          className="w-full sm:w-auto"
        >
          Close
        </Button>
      </div>
    </form>
  );
}
