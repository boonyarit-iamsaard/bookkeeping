"use client";

import type { CategorySummary } from "@bookkeeping/domain/categories";
import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";
import { useId, useState } from "react";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import { IconPicker } from "@/features/categories/components/icon-picker";
import { useEditCategoryForm } from "@/features/categories/hooks/use-edit-category-form";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

/** What a removal would do, worked out by the list that knows the tree. */
export interface RemovalContext {
  /** The parent's name for a child; null for a parent. */
  parentName: string | null;
  /** Children under a parent; a parent with any stays. */
  childCount: number;
  /** Current income or expense entries filed here. */
  entries: number;
}

interface EditCategoryFormProps {
  category: CategorySummary;
  removal: RemovalContext;
  onDone: (outcome: ManageCategoryOutcome) => void;
  onCancel: () => void;
}

/** "9 entries", "1 entry", "no entries". */
export function entriesLabel(count: number): string {
  if (count === 0) {
    return "no entries";
  }
  return count === 1 ? "1 entry" : `${count} entries`;
}

/**
 * The sheet behind a category row: rename and re-icon in one save, and
 * beneath a hairline, the removal with its consequence spelled out before
 * the destructive button appears. Its own form element, so Enter in the
 * name saves and never reaches anything behind the sheet.
 */
export function EditCategoryForm({
  category,
  removal,
  onDone,
  onCancel,
}: Readonly<EditCategoryFormProps>) {
  const prefix = useId();
  const nameId = `${prefix}-name`;
  const iconId = `${prefix}-icon`;
  const removeHeadingId = `${prefix}-remove`;
  const [confirming, setConfirming] = useState(false);
  const { form, serverError, fieldErrors, clearFieldError, remove, removing } =
    useEditCategoryForm({
      category,
      reassignedEntries: removal.entries,
      onDone,
    });
  const blocked = removal.childCount > 0;

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-1 pb-6 sm:px-6">
        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm"
          >
            {serverError}
          </div>
        )}
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
                    className="h-11 text-foreground read-only:text-muted-foreground"
                  />
                  {category.isProtected && (
                    <FieldDescription id={`${nameId}-description`}>
                      Uncategorized keeps its name; it is where a removed
                      parent's entries go.
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
                        value={field.state.value}
                        onChange={(next) => {
                          clearFieldError("iconId");
                          field.handleChange(next);
                        }}
                        aria-labelledby={`${iconId}-label`}
                        aria-describedby={
                          invalid ? `${iconId}-error` : undefined
                        }
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

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting || removing}
              className="h-11 w-full"
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          )}
        </form.Subscribe>

        <section
          aria-labelledby={removeHeadingId}
          className="flex flex-col items-start gap-3 border-t pt-6"
        >
          <h3 id={removeHeadingId} className="font-semibold text-base">
            {category.isProtected ? "A protected category" : "Remove"}
          </h3>
          <p className="text-muted-foreground text-sm leading-normal">
            {removalExplanation(category, removal)}
          </p>
          {!category.isProtected &&
            !blocked &&
            (confirming ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  disabled={removing}
                  onClick={remove}
                  className="h-11"
                >
                  {removing ? "Removing…" : `Remove ${category.name}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={removing}
                  onClick={() => setConfirming(false)}
                  className="h-11"
                >
                  Keep it
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setConfirming(true)}
                className="h-11"
              >
                Remove…
              </Button>
            ))}
        </section>
      </div>

      <div className="flex shrink-0 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6 sm:pb-4">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onCancel}
          className="h-11 w-full sm:w-auto"
        >
          Close
        </Button>
      </div>
    </form>
  );
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
