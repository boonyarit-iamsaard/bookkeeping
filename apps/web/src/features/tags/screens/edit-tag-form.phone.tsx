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
 * The sheet behind a tag row below 1024px: rename, which merges into another
 * tag when the name is already that tag's, then Save across the sheet, and
 * beneath a hairline, the deletion.
 */
export function EditTagFormPhone(props: Readonly<EditTagFormProps>) {
  const entryForm = useEditTagEntryForm(props);
  const { serverError, submit, pending, unchanged, saving, saveLabel } =
    entryForm;

  return (
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-1 pb-6 sm:px-6">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <TagNameSection entryForm={entryForm} />

        <Button
          type="submit"
          size="lg"
          disabled={pending || unchanged}
          className="w-full"
        >
          {saving ? "Saving…" : saveLabel}
        </Button>

        <TagDeleteSection entryForm={entryForm} />
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
