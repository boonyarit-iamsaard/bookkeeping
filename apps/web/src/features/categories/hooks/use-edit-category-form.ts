import type { CategorySummary } from "@bookkeeping/domain/categories";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { ApiFieldError, ApiRejection } from "@/core/api/write-submission";
import type { EditCategoryFormInput } from "@/features/categories/category-form-schema";
import { editCategoryFormSchema } from "@/features/categories/category-form-schema";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import { CATEGORY_MESSAGES } from "@/features/categories/category-name";

type Category = components["schemas"]["Category"];
type UpdateCategoryRequest = components["schemas"]["UpdateCategoryRequest"];

interface UseEditCategoryFormOptions {
  category: CategorySummary;
  reassignedEntries: number;
  onDone: (outcome: ManageCategoryOutcome) => void;
}

type EditField = keyof EditCategoryFormInput;

const EDIT_FIELDS: readonly EditField[] = ["name", "iconId"];

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  "blank-name": CATEGORY_MESSAGES.blankName,
  "name-too-long": CATEGORY_MESSAGES.nameTooLong,
  "unknown-icon": CATEGORY_MESSAGES.unknownIcon,
  "duplicate-name": "A category with this name already exists here.",
  protected: "Uncategorized keeps its name. Its icon can still change.",
};

function describeCategoryFieldError({
  code,
  detail,
}: Readonly<ApiFieldError>): string {
  return detail ?? FIELD_ERROR_MESSAGES[code] ?? "This value was not accepted.";
}

function describeCategoryRejection(
  rejection: Readonly<ApiRejection>,
): string | undefined {
  switch (rejection.problem.code) {
    case "protected":
      return "Uncategorized cannot be removed. It is where removed parents' entries go.";
    case "has-children":
      return "Remove or rename its child categories first; a parent with children stays.";
    case "in-use":
      return "An entry was just recorded under this category. Nothing changed; try again.";
    case "not-found":
    case "category-not-found":
      return CATEGORY_MESSAGES.gone;
    case "unauthenticated":
      return "Sign in again to manage this category.";
    default:
      return rejection.message;
  }
}

export function useEditCategoryForm({
  category,
  reassignedEntries,
  onDone,
}: Readonly<UseEditCategoryFormOptions>) {
  const { submit, isPending, serverError, fieldErrors, clearFieldError } =
    useFormWrites({
      fields: EDIT_FIELDS,
      writes: {
        update: {
          kind: "change",
          send: (input: UpdateCategoryRequest) =>
            apiClient.PATCH("/v1/categories/{categoryId}", {
              params: { path: { categoryId: category.id } },
              body: input,
            }),
          describeFieldError: describeCategoryFieldError,
          describeRejection: describeCategoryRejection,
          onDone: (updated: Category) =>
            onDone({ operation: "update", category: updated }),
        },
        remove: {
          kind: "delete",
          send: () =>
            apiClient.DELETE("/v1/categories/{categoryId}", {
              params: { path: { categoryId: category.id } },
            }),
          describeRejection: describeCategoryRejection,
          onDone: () =>
            onDone({ operation: "remove", reassigned: reassignedEntries }),
        },
      },
    });

  const defaultValues: EditCategoryFormInput = {
    name: category.name,
    iconId: category.iconId,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: editCategoryFormSchema },
    onSubmit: ({ value }) => submit.update(value),
  });

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    remove: () => submit.remove(),
    removing: isPending("remove"),
  };
}
