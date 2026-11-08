"use client";

import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import { GitMerge, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import { useEditTagForm } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { sameTagName, tagUsageLabel } from "@/features/tags/tag-search";
import { ConfirmPanel } from "@/shared/components/confirm-panel";
import { ErrorNotice } from "@/shared/components/error-notice";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface EditTagFormProps {
  tag: TagSummary;
  /** The owner's other tags, so a rename onto one says it will merge. */
  others: readonly TagSummary[];
  onDone: (outcome: EditTagOutcome) => void;
  onCancel: () => void;
}

/**
 * The sheet behind a tag row: rename, which merges into another tag when
 * the name is already that tag's, and beneath a hairline, the deletion
 * with its consequence spelled out before the destructive button appears.
 */
export function EditTagForm({
  tag,
  others,
  onDone,
  onCancel,
}: Readonly<EditTagFormProps>) {
  const prefix = useId();
  const nameId = `${prefix}-name`;
  const deleteHeadingId = `${prefix}-delete`;
  const [confirming, setConfirming] = useState(false);
  const {
    name,
    changeName,
    nameError,
    serverError,
    save,
    saving,
    remove,
    deleting,
  } = useEditTagForm({ tag, onDone });
  const survivor = others.find((other) => sameTagName(other.name, name));
  const unchanged = name === tag.name;
  const describedBy = [
    survivor ? `${nameId}-merge` : `${nameId}-description`,
    nameError ? `${nameId}-error` : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!unchanged) {
          void save();
        }
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-1 pb-6 sm:px-6">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        <FieldGroup className="gap-6">
          <Field data-invalid={Boolean(nameError)}>
            <FieldLabel htmlFor={nameId}>Name</FieldLabel>
            <Input
              id={nameId}
              name="name"
              type="text"
              autoComplete="off"
              autoFocus
              maxLength={MAX_TAG_NAME_LENGTH}
              value={name}
              onChange={(event) => changeName(event.target.value)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={describedBy}
            />
            {survivor ? (
              <p
                id={`${nameId}-merge`}
                className="bg-secondary text-secondary-foreground flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-normal"
              >
                <GitMerge
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span>
                  <span className="font-semibold">{survivor.name}</span> already
                  exists. Saving merges {tag.name} into it, so their
                  transactions share one tag named “{name.trim()}”.
                </span>
              </p>
            ) : (
              <FieldDescription id={`${nameId}-description`}>
                Renaming changes it on every transaction that carries it.
              </FieldDescription>
            )}
            <FieldErrors
              id={`${nameId}-error`}
              serverError={nameError}
              errors={[]}
            />
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          size="lg"
          disabled={saving || deleting || unchanged}
          className="w-full"
        >
          {saving ? "Saving…" : survivor ? "Merge tags" : "Save name"}
        </Button>

        {/* Deletion stands apart by space and a hairline, not color alone. */}
        <section
          aria-labelledby={deleteHeadingId}
          className="border-border/70 mt-2 flex flex-col gap-3 border-t pt-6"
        >
          <h3
            id={deleteHeadingId}
            className="text-base font-bold tracking-tight"
          >
            Delete
          </h3>
          {confirming ? (
            <ConfirmPanel
              actions={
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    disabled={deleting}
                    onClick={remove}
                    className="h-auto min-h-11 py-2 wrap-break-word whitespace-normal sm:min-h-10"
                  >
                    <Trash2 data-icon="inline-start" strokeWidth={1.75} />
                    {deleting ? "Deleting…" : `Delete ${tag.name}`}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={deleting}
                    onClick={() => setConfirming(false)}
                  >
                    Keep it
                  </Button>
                </>
              }
            >
              {deletionExplanation(tag)}
            </ConfirmPanel>
          ) : (
            <>
              <p className="text-muted-foreground text-sm leading-normal">
                {deletionExplanation(tag)}
              </p>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => setConfirming(true)}
                className="self-start"
              >
                <Trash2 data-icon="inline-start" strokeWidth={1.75} />
                Delete…
              </Button>
            </>
          )}
        </section>
      </div>

      <div className="border-border/70 flex shrink-0 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Close
        </Button>
      </div>
    </form>
  );
}

/** The consequence in the product's own words, before any button. */
function deletionExplanation(tag: Readonly<TagSummary>): string {
  if (tag.transactionCount === 0) {
    return `${tag.name} is not on any transaction. Deleting it changes nothing else.`;
  }
  const kept =
    tag.transactionCount === 1 ? "That transaction stays" : "They stay";
  return `Deleting ${tag.name} takes it off ${tagUsageLabel(tag.transactionCount)}. ${kept}, otherwise unchanged.`;
}
