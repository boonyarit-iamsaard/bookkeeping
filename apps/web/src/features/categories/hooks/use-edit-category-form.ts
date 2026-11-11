import type { CategorySummary } from "@bookkeeping/domain/categories";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { EditCategoryFormInput } from "@/features/categories/category-form-schema";
import { editCategoryFormSchema } from "@/features/categories/category-form-schema";
import type { ManageCategoryOutcome } from "@/features/categories/category-mutations";
import {
  describeCategoryFieldError,
  describeCategoryRejection,
} from "@/features/categories/category-rejection";

type Category = components["schemas"]["Category"];
type UpdateCategoryRequest = components["schemas"]["UpdateCategoryRequest"];

interface UseEditCategoryFormOptions {
  category: CategorySummary;
  reassignedEntries: number;
  onDone: (outcome: ManageCategoryOutcome) => void;
}

type EditField = keyof EditCategoryFormInput;

const EDIT_FIELDS: readonly EditField[] = ["name", "iconId"];

export function useEditCategoryForm({
  category,
  reassignedEntries,
  onDone,
}: Readonly<UseEditCategoryFormOptions>) {
  const {
    submit,
    pending,
    isRunning,
    serverError,
    fieldErrors,
    clearFieldError,
  } = useFormWrites({
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
    onSubmit: ({ value }) => submit("update", value),
  });

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    remove: () => submit("remove"),
    pending,
    removing: isRunning("remove"),
  };
}
