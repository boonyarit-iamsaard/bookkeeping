"use client";

import {
  TagDeleteSection,
  TagNameSection,
} from "@/features/tags/components/edit-tag-form-sections";
import type { EditTagFormProps } from "@/features/tags/hooks/use-edit-tag-entry-form";
import { useEditTagEntryForm } from "@/features/tags/hooks/use-edit-tag-entry-form";
import { ErrorNotice } from "@/shared/components/error-notice";
import { Button } from "@/shared/components/ui/button";

/**
 * The dialog behind a tag row from 1024px: the rename and the deletion
 * scroll, and Cancel and Save stay pinned at the foot. Enter saves.
 */
export function EditTagFormDesktop(props: Readonly<EditTagFormProps>) {
  const entryForm = useEditTagEntryForm(props);
  const { serverError, submit, pending, unchanged, saving, saveLabel } =
    entryForm;

  return (
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-6 overflow-y-auto border-t px-6 py-6 *:shrink-0">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <TagNameSection entryForm={entryForm} />
        <TagDeleteSection entryForm={entryForm} />
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
        <Button type="submit" size="lg" disabled={pending || unchanged}>
          {saving ? "Saving…" : saveLabel}
        </Button>
      </footer>
    </form>
  );
}
