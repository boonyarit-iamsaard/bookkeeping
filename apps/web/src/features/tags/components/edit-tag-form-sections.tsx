import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import { GitMerge, Trash2 } from "lucide-react";
import type { EditTagEntryForm } from "@/features/tags/hooks/use-edit-tag-entry-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { tagUsageLabel } from "@/features/tags/tag-search";
import { ConfirmPanel } from "@/shared/components/confirm-panel";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

// The parts of the edit tag form, shared by its phone and desktop compositions.

interface EditTagSectionProps {
  entryForm: EditTagEntryForm;
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

/** Rename, which says when it will merge into another tag. */
export function TagNameSection({
  entryForm: {
    tag,
    name,
    changeName,
    nameError,
    nameId,
    survivor,
    describedBy,
  },
}: Readonly<EditTagSectionProps>) {
  return (
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
              exists. Saving merges {tag.name} into it, so their transactions
              share one tag named “{name.trim()}”.
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
  );
}

/** The deletion, with its consequence spelled out before the destructive button. */
export function TagDeleteSection({
  entryForm: {
    tag,
    deleteHeadingId,
    confirming,
    setConfirming,
    pending,
    deleting,
    remove,
  },
}: Readonly<EditTagSectionProps>) {
  return (
    // Deletion stands apart by space and a hairline, not color alone.
    <section
      aria-labelledby={deleteHeadingId}
      className="border-border/70 mt-2 flex flex-col gap-3 border-t pt-6"
    >
      <h3 id={deleteHeadingId} className="text-base font-bold tracking-tight">
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
                disabled={pending}
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
                disabled={pending}
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
  );
}
