"use client";

import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";
import { Plus } from "lucide-react";
import { useId } from "react";
import {
  NEW_PARENT,
  NO_PARENT,
} from "@/features/categories/category-form-schema";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import { topLevelParents } from "@/features/categories/category-search";
import { CategoryIcon } from "@/features/categories/components/category-icon";
import { IconPicker } from "@/features/categories/components/icon-picker";
import { useCreateCategoryForm } from "@/features/categories/hooks/use-create-category-form";
import type { CreateCategoryActionSuccess } from "@/features/categories/server/category.actions";
import { FieldErrors } from "@/shared/components/form/field-errors";
import { Button } from "@/shared/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface CreateCategoryFormProps {
  kind: CategoryKind;
  /** Both trees; only this kind's top-level parents are offered. */
  categories: readonly CategorySummary[];
  /** Prefilled from the unmatched search query. */
  initialName: string;
  /** Preselects an existing parent, e.g. from the group the query fell in. */
  initialParentId?: string;
  onCreated: (outcome: CreateCategoryActionSuccess) => void;
  onCancel: () => void;
}

/**
 * Lives inside the category panel. Its own form element: submit events are
 * stopped here so Enter can never reach the transaction form behind it.
 */
export function CreateCategoryForm({
  kind,
  categories,
  initialName,
  initialParentId,
  onCreated,
  onCancel,
}: Readonly<CreateCategoryFormProps>) {
  const prefix = useId();
  const {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    chooseIcon,
    followName,
  } = useCreateCategoryForm({
    kind,
    initialName,
    initialParentId,
    onCreated,
  });
  const parents = topLevelParents(categories, kind);
  const nameId = `${prefix}-name`;
  const parentId = `${prefix}-parent`;
  const parentNameId = `${prefix}-parent-name`;
  const parentIconId = `${prefix}-parent-icon`;
  const iconId = `${prefix}-icon`;

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
          <form.Field
            name="name"
            listeners={{
              onChange: ({ value }) => followName("iconId", value),
            }}
          >
            {(field) => {
              const serverFieldError = fieldErrors.name;
              const invalid =
                !field.state.meta.isValid || Boolean(serverFieldError);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={nameId}>Name</FieldLabel>
                  <Input
                    id={nameId}
                    name={field.name}
                    type="text"
                    autoComplete="off"
                    autoFocus
                    maxLength={MAX_CATEGORY_NAME_LENGTH}
                    placeholder="Bubble tea"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      clearFieldError("name");
                      field.handleChange(event.target.value);
                    }}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${nameId}-error` : undefined}
                    className="h-11 text-foreground"
                  />
                  <FieldErrors
                    id={`${nameId}-error`}
                    serverError={serverFieldError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="parent">
            {(field) => {
              const serverFieldError = fieldErrors.parent;
              const invalid =
                !field.state.meta.isValid || Boolean(serverFieldError);
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={parentId}>Parent</FieldLabel>
                  <Select
                    name={field.name}
                    value={
                      field.state.value === NO_PARENT ? null : field.state.value
                    }
                    onValueChange={(next) => {
                      clearFieldError("parent");
                      field.handleChange(next ?? NO_PARENT);
                    }}
                  >
                    <SelectTrigger
                      id={parentId}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid}
                      aria-describedby={
                        invalid
                          ? `${parentId}-description ${parentId}-error`
                          : `${parentId}-description`
                      }
                    >
                      <SelectValue>
                        {(selected: string | null) => {
                          if (selected === NEW_PARENT) {
                            return "New parent…";
                          }
                          const parent = parents.find(
                            (candidate) => candidate.id === selected,
                          );
                          if (parent) {
                            return (
                              <>
                                <CategoryIcon
                                  iconId={parent.iconId}
                                  className="size-4"
                                />
                                <span className="truncate">{parent.name}</span>
                              </>
                            );
                          }
                          return (
                            <span className="truncate">
                              {"None"}{" "}
                              <span className="text-muted-foreground">
                                · a new{" "}
                                {CATEGORY_KIND_LABELS[kind].toLowerCase()}{" "}
                                parent category
                              </span>
                            </span>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null} label="None">
                        <span>
                          {"None"}{" "}
                          <span className="font-normal text-muted-foreground">
                            · a new {CATEGORY_KIND_LABELS[kind].toLowerCase()}{" "}
                            parent category
                          </span>
                        </span>
                      </SelectItem>
                      {parents.length > 0 && <SelectSeparator />}
                      {parents.map((parent) => (
                        <SelectItem
                          key={parent.id}
                          value={parent.id}
                          label={parent.name}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                              <CategoryIcon
                                iconId={parent.iconId}
                                className="size-4"
                              />
                            </span>
                            <span className="truncate">{parent.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={NEW_PARENT} label="New parent…">
                        <span className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                            <Plus
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-4"
                            />
                          </span>
                          <span>New parent…</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription id={`${parentId}-description`}>
                    Parent categories group child categories; there is no third
                    level.
                  </FieldDescription>
                  <FieldErrors
                    id={`${parentId}-error`}
                    serverError={serverFieldError}
                    errors={field.state.meta.errors}
                  />
                </Field>
              );
            }}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.parent}>
            {(parent) =>
              parent === NEW_PARENT && (
                <fieldset className="flex flex-col gap-6 rounded-xl border p-4">
                  <legend className="px-1 font-medium text-sm">
                    New parent
                  </legend>
                  <form.Field
                    name="parentName"
                    listeners={{
                      onChange: ({ value }) =>
                        followName("parentIconId", value),
                    }}
                  >
                    {(field) => {
                      const serverFieldError = fieldErrors.parentName;
                      const invalid =
                        !field.state.meta.isValid || Boolean(serverFieldError);
                      return (
                        <Field data-invalid={invalid}>
                          <FieldLabel htmlFor={parentNameId}>
                            Parent name
                          </FieldLabel>
                          <Input
                            id={parentNameId}
                            name={field.name}
                            type="text"
                            autoComplete="off"
                            autoFocus
                            maxLength={MAX_CATEGORY_NAME_LENGTH}
                            placeholder="Drinks"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => {
                              clearFieldError("parentName");
                              field.handleChange(event.target.value);
                            }}
                            aria-invalid={invalid}
                            aria-describedby={
                              invalid ? `${parentNameId}-error` : undefined
                            }
                            className="h-11 text-foreground"
                          />
                          <FieldErrors
                            id={`${parentNameId}-error`}
                            serverError={serverFieldError}
                            errors={field.state.meta.errors}
                          />
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Subscribe selector={(state) => state.values.parentName}>
                    {(parentName) => (
                      <form.Field name="parentIconId">
                        {(field) => {
                          const serverFieldError = fieldErrors.parentIconId;
                          const invalid =
                            !field.state.meta.isValid ||
                            Boolean(serverFieldError);
                          return (
                            <Field data-invalid={invalid}>
                              <FieldLabel id={`${parentIconId}-label`}>
                                Parent icon
                              </FieldLabel>
                              <IconPicker
                                name={parentName}
                                value={field.state.value}
                                onChange={(next) => {
                                  clearFieldError("parentIconId");
                                  chooseIcon("parentIconId", next);
                                }}
                                aria-labelledby={`${parentIconId}-label`}
                                aria-describedby={
                                  invalid ? `${parentIconId}-error` : undefined
                                }
                              />
                              <FieldErrors
                                id={`${parentIconId}-error`}
                                serverError={serverFieldError}
                                errors={field.state.meta.errors}
                              />
                            </Field>
                          );
                        }}
                      </form.Field>
                    )}
                  </form.Subscribe>
                </fieldset>
              )
            }
          </form.Subscribe>

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
                          chooseIcon("iconId", next);
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
      </div>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onCancel}
              className="h-11"
            >
              Back
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="h-11"
            >
              {isSubmitting ? "Saving…" : "Save category"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
