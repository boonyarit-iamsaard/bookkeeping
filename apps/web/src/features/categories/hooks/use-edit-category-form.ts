import type { CategorySummary } from "@bookkeeping/domain/categories";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { categoryQueries } from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
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

const CONNECTION_MESSAGE =
  "The change could not be confirmed. Your values are kept; try again.";

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<EditField, string>>
  >({});
  const [removing, startRemoval] = useTransition();
  const updateCategory = useApiMutation<UpdateCategoryRequest, Category>({
    send: (input) =>
      apiClient.PATCH("/v1/categories/{categoryId}", {
        params: { path: { categoryId: category.id } },
        body: input,
      }),
    describeFieldError: describeCategoryFieldError,
  });
  const removeCategory = useApiMutation<undefined, unknown>({
    send: () =>
      apiClient.DELETE("/v1/categories/{categoryId}", {
        params: { path: { categoryId: category.id } },
      }),
  });

  const defaultValues: EditCategoryFormInput = {
    name: category.name,
    iconId: category.iconId,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: editCategoryFormSchema },
    onSubmit: ({ value }) => save(value),
  });

  async function invalidateCategoryReads() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: categoryQueries.list().queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: categoryQueries.usage().queryKey,
      }),
    ]);
  }

  async function save(value: Readonly<EditCategoryFormInput>) {
    setServerError(undefined);
    setFieldErrors({});
    let result: Awaited<ReturnType<typeof updateCategory.submit>>;
    try {
      result = await updateCategory.submit(value);
    } catch {
      setServerError(CONNECTION_MESSAGE);
      return;
    }
    if (!result.ok) {
      setFieldErrors(result.error.fieldErrors);
      setServerError(describeCategoryRejection(result.error));
      return;
    }
    await invalidateCategoryReads();
    onDone({ operation: "update", category: result.value });
  }

  function remove() {
    startRemoval(() => {
      void removeCategory
        .submit(undefined)
        .then(async (result) => {
          if (!result.ok) {
            setServerError(describeCategoryRejection(result.error));
            return;
          }
          await invalidateCategoryReads();
          onDone({ operation: "remove", reassigned: reassignedEntries });
        })
        .catch(() => setServerError(CONNECTION_MESSAGE));
    });
  }

  function clearFieldError(field: EditField) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    remove,
    removing: removing || removeCategory.isPending,
  };
}
