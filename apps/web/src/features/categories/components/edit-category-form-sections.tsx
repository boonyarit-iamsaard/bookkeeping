import type { CategorySummary } from "@bookkeeping/domain/categories";
import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";
import type { LucideIcon } from "lucide-react";
import { ListTree, LockKeyhole, Trash2 } from "lucide-react";
import { IconPicker } from "@/features/categories/components/icon-picker";
import type {
  EditCategoryEntryForm,
  RemovalContext,
} from "@/features/categories/hooks/use-edit-category-entry-form";
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

// The parts of the edit category form, shared by its phone and desktop
// compositions.

interface EditCategorySectionProps {
  entryForm: EditCategoryEntryForm;
}

/** "9 entries", "1 entry", "no entries". */
export function entriesLabel(count: number): string {
  if (count === 0) {
    return "no entries";
  }
  return count === 1 ? "1 entry" : `${count} entries`;
}

/** The consequence in the product's own words, before any button. */
function removalExplanation(
  category: Readonly<CategorySummary>,
  removal: Readonly<RemovalContext>,
): string {
  if (category.isProtected) {
    return "Uncategorized cannot be removed or renamed. Removed parents hand their entries here, so it always exists. Its icon can change.";
  }
  if (removal.childCount > 0) {
    const children =
      removal.childCount === 1
        ? "1 child category"
        : `${removal.childCount} child categories`;
    return `A parent with children stays. Remove its ${children} first; each one's entries move up to ${category.name} as you go.`;
  }
  if (removal.entries === 0) {
    return `${category.name} has no entries. Removing it changes nothing else.`;
  }
  const destination = removal.parentName ?? "Uncategorized";
  return `Removing ${category.name} moves its ${entriesLabel(removal.entries)}, and any refunds linked to them, to ${destination}.`;
}

interface RemovalPanelProps {
  icon: LucideIcon;
  children: React.ReactNode;
}

/** Why this category stays, on a Mist panel led by the reason's pictogram. */
function RemovalPanel({ icon: Icon, children }: Readonly<RemovalPanelProps>) {
  return (
    <p className="bg-muted text-foreground flex items-start gap-3 rounded-xl p-4 text-sm leading-normal">
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      {children}
    </p>
  );
}

/** Rename and re-icon in one save. */
export function CategoryFieldsSection({
  entryForm: {
    form,
    category,
    color,
    fieldErrors,
    clearFieldError,
    nameId,
    iconId,
  },
}: Readonly<EditCategorySectionProps>) {
  return (
    <FieldGroup className="gap-6">
      <form.Field name="name">
        {(field) => {
          const serverFieldError = fieldErrors.name;
          const invalid =
            !field.state.meta.isValid || Boolean(serverFieldError);
          const describedBy = [
            category.isProtected ? `${nameId}-description` : undefined,
            invalid ? `${nameId}-error` : undefined,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={nameId}>Name</FieldLabel>
              <Input
                id={nameId}
                name={field.name}
                type="text"
                autoComplete="off"
                autoFocus={!category.isProtected}
                readOnly={category.isProtected}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  clearFieldError("name");
                  field.handleChange(event.target.value);
                }}
                aria-invalid={invalid}
                aria-describedby={describedBy || undefined}
                className="read-only:bg-muted read-only:text-muted-foreground"
              />
              {category.isProtected && (
                <FieldDescription id={`${nameId}-description`}>
                  Uncategorized keeps its name; it is where a removed parent's
                  entries go.
                </FieldDescription>
              )}
              <FieldErrors
                id={`${nameId}-error`}
                serverError={serverFieldError}
                errors={field.state.meta.errors}
              />
            </Field>
          );
        }}
      </form.Field>

      <form.Subscribe selector={(state) => state.values.name}>
        {(name) => (
          <form.Field name="iconId">
            {(field) => {
              const serverFieldError = fieldErrors.iconId;
              const invalid =
                !field.state.meta.isValid || Boolean(serverFieldError);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel id={`${iconId}-label`}>Icon</FieldLabel>
                  <IconPicker
                    name={name}
                    color={color}
                    value={field.state.value}
                    onChange={(next) => {
                      clearFieldError("iconId");
                      field.handleChange(next);
                    }}
                    aria-labelledby={`${iconId}-label`}
                    aria-describedby={invalid ? `${iconId}-error` : undefined}
                  />
                  <FieldErrors
                    id={`${iconId}-error`}
                    serverError={serverFieldError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>
        )}
      </form.Subscribe>
    </FieldGroup>
  );
}

/** The removal, with its consequence spelled out before the destructive button. */
export function CategoryRemovalSection({
  entryForm: {
    category,
    removal,
    removeHeadingId,
    confirming,
    setConfirming,
    pending,
    removing,
    remove,
  },
}: Readonly<EditCategorySectionProps>) {
  const blocked = removal.childCount > 0;
  const removalControls = confirming ? (
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
            {removing ? "Removing…" : `Remove ${category.name}`}
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
      {removalExplanation(category, removal)}
    </ConfirmPanel>
  ) : (
    <>
      <p className="text-muted-foreground text-sm leading-normal">
        {removalExplanation(category, removal)}
      </p>
      <Button
        type="button"
        variant="destructive"
        size="lg"
        onClick={() => setConfirming(true)}
        className="self-start"
      >
        <Trash2 data-icon="inline-start" strokeWidth={1.75} />
        Remove…
      </Button>
    </>
  );

  return (
    // Removal stands apart by space and a hairline, not color alone.
    <section
      aria-labelledby={removeHeadingId}
      className="border-border/70 mt-2 flex flex-col gap-3 border-t pt-6"
    >
      <h3 id={removeHeadingId} className="text-base font-bold tracking-tight">
        {category.isProtected ? "A protected category" : "Remove"}
      </h3>
      {category.isProtected || blocked ? (
        <RemovalPanel icon={category.isProtected ? LockKeyhole : ListTree}>
          {removalExplanation(category, removal)}
        </RemovalPanel>
      ) : (
        removalControls
      )}
    </section>
  );
}
