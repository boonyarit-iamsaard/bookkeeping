"use client";

import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";
import { Plus } from "lucide-react";
import { useId } from "react";
import { createCategoryColors } from "@/features/categories/category-color";
import {
  NEW_PARENT,
  NO_PARENT,
} from "@/features/categories/category-form-schema";
import { CATEGORY_KIND_LABELS } from "@/features/categories/category-labels";
import type { CreateCategoryOutcome } from "@/features/categories/category-mutations";
import { topLevelParents } from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
} from "@/features/categories/components/category-icon";
import { IconPicker } from "@/features/categories/components/icon-picker";
import { useCreateCategoryForm } from "@/features/categories/hooks/use-create-category-form";
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
  onCreated: (outcome: CreateCategoryOutcome) => void;
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
    isSaved,
    isRefreshing,
    retryRead,
  } = useCreateCategoryForm({
    kind,
    initialName,
    initialParentId,
    onCreated,
  });
  const parents = topLevelParents(categories, kind);
  const colorOf = createCategoryColors(categories);
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
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pt-1 pb-6 sm:px-6">
        {serverError && <ErrorNotice>{serverError}</ErrorNotice>}
        {isSaved && isRefreshing && (
          <output className="text-muted-foreground text-sm">
            Category saved. Refreshing categories…
          </output>
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
                                <CategoryTile
                                  color={colorOf(parent.id)}
                                  className="size-7 rounded-md [&_svg]:size-4"
                                >
                                  <CategoryIcon iconId={parent.iconId} />
                                </CategoryTile>
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
                            <CategoryTile
                              color={colorOf(parent.id)}
                              className="size-8 rounded-md [&_svg]:size-4"
                            >
                              <CategoryIcon iconId={parent.iconId} />
                            </CategoryTile>
                            <span className="wrap-break-word min-w-0">
                              {parent.name}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={NEW_PARENT} label="New parent…">
                        <span className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                            <Plus
                              aria-hidden="true"
                              strokeWidth={2}
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
                <fieldset className="rounded-xl bg-muted p-4">
                  <legend className="float-left mb-4 w-full font-bold text-base tracking-tight">
                    New parent
                  </legend>
                  <div className="clear-both flex flex-col gap-6">
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
                          !field.state.meta.isValid ||
                          Boolean(serverFieldError);
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
                    <form.Subscribe
                      selector={(state) => state.values.parentName}
                    >
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
                                  color="neutral"
                                  value={field.state.value}
                                  onChange={(next) => {
                                    clearFieldError("parentIconId");
                                    chooseIcon("parentIconId", next);
                                  }}
                                  aria-labelledby={`${parentIconId}-label`}
                                  aria-describedby={
                                    invalid
                                      ? `${parentIconId}-error`
                                      : undefined
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
                  </div>
                </fieldset>
              )
            }
          </form.Subscribe>

          <form.Subscribe
            selector={(state) => [state.values.name, state.values.parent]}
          >
            {([name = "", parent]) => (
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
                        // A chosen parent lends its hue; no parent or a new
                        // one is not a known id, so the preview stays neutral.
                        color={colorOf(parent ?? NO_PARENT)}
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
          <div className="flex shrink-0 flex-col-reverse gap-2 border-border/70 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
              Back
            </Button>
            {isSaved && serverError && (
              <Button
                type="button"
                size="lg"
                disabled={isRefreshing}
                onClick={() => void retryRead()}
              >
                Retry category list
              </Button>
            )}
            <Button type="submit" size="lg" disabled={isSubmitting || isSaved}>
              {isSaved ? "Saved" : isSubmitting ? "Saving…" : "Save category"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
