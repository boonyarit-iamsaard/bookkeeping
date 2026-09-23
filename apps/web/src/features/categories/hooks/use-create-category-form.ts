import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";
import { GENERIC_ICON_ID } from "@bookkeeping/domain/categories";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { categoryQueries } from "@/core/api/queries";
import { useApiMutation } from "@/core/api/use-api-mutation";
import type { ApiFieldError, ApiRejection } from "@/core/api/write-submission";
import { refreshAfterWrite } from "@/core/query/refresh-after-write";
import type { CategoryFormInput } from "@/features/categories/category-form-schema";
import {
  categoryFormSchema,
  createCategorySubmissionSchema,
  NO_PARENT,
  toCreateCategorySubmission,
} from "@/features/categories/category-form-schema";
import type { CreateCategoryOutcome } from "@/features/categories/category-mutations";
import { CATEGORY_MESSAGES } from "@/features/categories/category-name";
import { suggestIcons } from "@/features/categories/icon-suggestions";

type CreateCategoryRequest = components["schemas"]["CreateCategoryRequest"];
type Category = components["schemas"]["Category"];
type CategoryCollection = components["schemas"]["CategoryCollection"];
type CategoryFormField = keyof CategoryFormInput;

interface UseCreateCategoryFormOptions {
  kind: CategoryKind;
  /** The unmatched search query, prefilled as the name. */
  initialName: string;
  /** An existing top-level parent to preselect, if the query fell in one. */
  initialParentId?: string;
  onCreated: (outcome: CreateCategoryOutcome) => void;
}

type IconField = "iconId" | "parentIconId";

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  "blank-name": CATEGORY_MESSAGES.blankName,
  "name-too-long": CATEGORY_MESSAGES.nameTooLong,
  "unknown-icon": CATEGORY_MESSAGES.unknownIcon,
  "duplicate-name": "A category with this name already exists here.",
  "parent-not-found":
    "That parent is not available. Choose another or create one.",
  "parent-is-child":
    "A child category cannot hold children. Choose a parent category.",
  "parent-protected":
    "Uncategorized cannot hold children. Choose another parent.",
};

/** The top local recommendation, or the generic icon when nothing matches. */
function recommendedIconId(name: string): string {
  return suggestIcons(name)[0]?.id ?? GENERIC_ICON_ID;
}

function describeCategoryFieldError({
  code,
  detail,
  pointer,
}: Readonly<ApiFieldError>): string {
  if (code === "duplicate-name" && pointer.startsWith("#/parent")) {
    return "A category with this name already exists in this tree. Pick it as the parent instead.";
  }
  return detail ?? FIELD_ERROR_MESSAGES[code] ?? "This value was not accepted.";
}

function fieldFromPointer(pointer: string): CategoryFormField | undefined {
  switch (pointer) {
    case "#/parent/create/name":
      return "parentName";
    case "#/parent/create/iconId":
      return "parentIconId";
    case "#/parent":
      return "parent";
    case "#/name":
      return "name";
    case "#/iconId":
      return "iconId";
    default:
      return undefined;
  }
}

function categoryFieldErrors(
  rejection: Readonly<ApiRejection>,
): Partial<Record<CategoryFormField, string>> {
  const fieldErrors: Partial<Record<CategoryFormField, string>> = {
    ...rejection.fieldErrors,
  };
  for (const fieldError of rejection.errors) {
    const field = fieldFromPointer(fieldError.pointer);
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = describeCategoryFieldError(fieldError);
    }
  }
  return fieldErrors;
}

function describeCategoryRejection(
  rejection: Readonly<ApiRejection>,
): string | undefined {
  if (rejection.problem.code === "unauthenticated") {
    return "Sign in again to create a category.";
  }
  return rejection.message;
}

export function useCreateCategoryForm({
  kind,
  initialName,
  initialParentId,
  onCreated,
}: Readonly<UseCreateCategoryFormOptions>) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CategoryFormField, string>>
  >({});
  // An icon follows its name's top recommendation until picked by hand.
  const manualIcons = useRef<Record<IconField, boolean>>({
    iconId: false,
    parentIconId: false,
  });
  const createCategory = useApiMutation<CreateCategoryRequest, Category>({
    send: (input, attempt) =>
      apiClient.POST("/v1/categories", {
        params: { header: attempt.header },
        body: input,
      }),
    describeFieldError: describeCategoryFieldError,
  });

  const defaultValues: CategoryFormInput = {
    name: initialName,
    iconId: recommendedIconId(initialName),
    parent: initialParentId ?? NO_PARENT,
    parentName: "",
    parentIconId: GENERIC_ICON_ID,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: categoryFormSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(undefined);
      setFieldErrors({});

      const parsed = createCategorySubmissionSchema.safeParse(
        toCreateCategorySubmission(kind, value),
      );
      if (!parsed.success) {
        return;
      }

      let result: Awaited<ReturnType<typeof createCategory.submit>>;
      try {
        result = await createCategory.submit(parsed.data);
      } catch {
        setServerError(
          "The category could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        setFieldErrors(categoryFieldErrors(result.error));
        setServerError(describeCategoryRejection(result.error));
        return;
      }

      // The category list is on screen wherever this form is, so it has
      // re-read by the time the created parent is looked up below.
      await refreshAfterWrite(queryClient);

      let createdParent: CategorySummary | undefined;
      if (parsed.data.parent && "create" in parsed.data.parent) {
        const categories = queryClient.getQueryData<CategoryCollection>(
          categoryQueries.list().queryKey,
        );
        createdParent = categories?.items.find(
          (category) => category.id === result.value.parentId,
        );
      }
      onCreated({
        category: result.value,
        ...(createdParent ? { createdParent } : {}),
      });
    },
  });

  function chooseIcon(field: IconField, iconId: string) {
    manualIcons.current[field] = true;
    form.setFieldValue(field, iconId);
  }

  function followName(field: IconField, name: string) {
    if (!manualIcons.current[field]) {
      form.setFieldValue(field, recommendedIconId(name));
    }
  }

  function clearFieldError(field: CategoryFormField) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  return {
    form,
    serverError,
    fieldErrors,
    clearFieldError,
    chooseIcon,
    followName,
  };
}
