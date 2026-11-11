import type { CategoryKind } from "@bookkeeping/domain/categories";
import { GENERIC_ICON_ID } from "@bookkeeping/domain/categories";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiClient } from "@/core/api/client";
import type { components } from "@/core/api/openapi.gen";
import { categoryQueries } from "@/core/api/queries";
import { useFormWrites } from "@/core/api/use-form-writes";
import type { CategoryFormInput } from "@/features/categories/category-form-schema";
import {
  categoryFormSchema,
  createCategorySubmissionSchema,
  NO_PARENT,
  toCreateCategorySubmission,
} from "@/features/categories/category-form-schema";
import type { CreateCategoryOutcome } from "@/features/categories/category-mutations";
import {
  CATEGORY_FORM_FIELDS,
  categoryFieldOf,
  describeCategoryFieldError,
  describeCategoryRejection,
} from "@/features/categories/category-rejection";
import { suggestIcons } from "@/features/categories/icon-suggestions";

type CreateCategoryRequest = components["schemas"]["CreateCategoryRequest"];
type Category = components["schemas"]["Category"];
type CategoryCollection = components["schemas"]["CategoryCollection"];

interface SavedCategory {
  category: Category;
  includesNewParent: boolean;
}

interface UseCreateCategoryFormOptions {
  kind: CategoryKind;
  /** The unmatched search query, prefilled as the name. */
  initialName: string;
  /** An existing top-level parent to preselect, if the query fell in one. */
  initialParentId?: string;
  onCreated: (outcome: CreateCategoryOutcome) => void;
}

type IconField = "iconId" | "parentIconId";

/** The top local recommendation, or the generic icon when nothing matches. */
function recommendedIconId(name: string): string {
  return suggestIcons(name)[0]?.id ?? GENERIC_ICON_ID;
}

const LIST_NOT_REFRESHED =
  "Category saved; list could not refresh. Retry the category list to continue.";

export function useCreateCategoryForm({
  kind,
  initialName,
  initialParentId,
  onCreated,
}: Readonly<UseCreateCategoryFormOptions>) {
  const queryClient = useQueryClient();
  // The saved category's recovery: its list read failed after the save.
  const [recoveryError, setRecoveryError] = useState<string | undefined>();
  const savedCategory = useRef<SavedCategory | undefined>(undefined);
  const [isSaved, setIsSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // An icon follows its name's top recommendation until picked by hand.
  const manualIcons = useRef<Record<IconField, boolean>>({
    iconId: false,
    parentIconId: false,
  });
  const {
    submit,
    serverError: writeError,
    fieldErrors,
    clearFieldError,
  } = useFormWrites({
    fields: CATEGORY_FORM_FIELDS,
    fieldOf: categoryFieldOf,
    writes: {
      create: {
        kind: "create",
        send: async (input: CreateCategoryRequest, attempt) => {
          const response = await apiClient.POST("/v1/categories", {
            params: { header: attempt.header },
            body: input,
          });
          if (response.data) {
            // Durable from here: the list refresh may fail, the save cannot.
            savedCategory.current = {
              category: response.data,
              includesNewParent: Boolean(
                input.parent && "create" in input.parent,
              ),
            };
            setIsSaved(true);
            setIsRefreshing(true);
          }
          return response;
        },
        describeFieldError: describeCategoryFieldError,
        describeRejection: describeCategoryRejection,
        onDone: (_created: Category) => {
          setIsRefreshing(false);
          finishFromCatalog();
        },
      },
    },
  });

  const defaultValues: CategoryFormInput = {
    name: initialName,
    iconId: recommendedIconId(initialName),
    parent: initialParentId ?? NO_PARENT,
    parentName: "",
    parentIconId: GENERIC_ICON_ID,
  };

  function finishFromCatalog() {
    const saved = savedCategory.current;
    if (!saved) {
      return;
    }
    const query = categoryQueries.list();
    const collection = queryClient.getQueryData<CategoryCollection>(
      query.queryKey,
    );
    const category = collection?.items.find(
      (entry) => entry.id === saved.category.id,
    );
    const parent = category?.parentId
      ? collection?.items.find((entry) => entry.id === category.parentId)
      : undefined;
    if (
      queryClient.getQueryState(query.queryKey)?.status !== "success" ||
      !category ||
      (category.parentId && !parent)
    ) {
      setRecoveryError(LIST_NOT_REFRESHED);
      return;
    }
    onCreated({
      category,
      ...(saved.includesNewParent && parent ? { createdParent: parent } : {}),
    });
  }

  async function retryRead() {
    if (!savedCategory.current || isRefreshing) {
      return;
    }
    setRecoveryError(undefined);
    setIsRefreshing(true);
    try {
      // Re-read only: the category is already durable, and no POST is replayed.
      await queryClient.fetchQuery({
        ...categoryQueries.list(),
        staleTime: 0,
        retry: false,
      });
    } catch {
      setRecoveryError(LIST_NOT_REFRESHED);
      setIsRefreshing(false);
      return;
    }
    setIsRefreshing(false);
    finishFromCatalog();
  }

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: categoryFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (savedCategory.current) {
        return;
      }
      const parsed = createCategorySubmissionSchema.safeParse(
        toCreateCategorySubmission(kind, value),
      );
      if (!parsed.success) {
        return;
      }
      await submit("create", parsed.data);
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

  return {
    form,
    serverError: recoveryError ?? writeError,
    fieldErrors,
    clearFieldError,
    chooseIcon,
    followName,
    isSaved,
    isRefreshing,
    retryRead,
  };
}
