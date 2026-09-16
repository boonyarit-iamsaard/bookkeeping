"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CategoryKind } from "@/features/categories/category.types";
import type { CategoryFormInput } from "@/features/categories/category-form-schema";
import {
  categoryFormSchema,
  NO_PARENT,
  toCreateCategorySubmission,
} from "@/features/categories/category-form-schema";
import { suggestIcons } from "@/features/categories/icon-suggestions";
import { GENERIC_ICON_ID } from "@/features/categories/icons";
import type {
  CategoryFormField,
  CreateCategoryActionError,
  CreateCategoryActionSuccess,
} from "@/features/categories/server/category.actions";
import { createCategoryAction } from "@/features/categories/server/category.actions";

interface UseCreateCategoryFormOptions {
  kind: CategoryKind;
  /** The unmatched search query, prefilled as the name. */
  initialName: string;
  /** An existing top-level parent to preselect, if the query fell in one. */
  initialParentId?: string;
  onCreated: (outcome: CreateCategoryActionSuccess) => void;
}

type IconField = "iconId" | "parentIconId";

/** The top local recommendation, or the generic icon when nothing matches. */
function recommendedIconId(name: string): string {
  return suggestIcons(name)[0]?.id ?? GENERIC_ICON_ID;
}

export function useCreateCategoryForm({
  kind,
  initialName,
  initialParentId,
  onCreated,
}: Readonly<UseCreateCategoryFormOptions>) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<CategoryFormField, string>>
  >({});
  // An icon follows its name's top recommendation until picked by hand.
  const manualIcons = useRef<Record<IconField, boolean>>({
    iconId: false,
    parentIconId: false,
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
      setServerError(null);
      setFieldErrors({});

      let result: Awaited<ReturnType<typeof createCategoryAction>>;
      try {
        result = await createCategoryAction(
          toCreateCategorySubmission(kind, value),
        );
      } catch {
        setServerError(
          "The category could not be saved. Check your connection and try again.",
        );
        return;
      }

      if (!result.ok) {
        applyRejection(result.error);
        return;
      }
      onCreated(result.value);
    },
  });

  function applyRejection(error: CreateCategoryActionError) {
    switch (error.code) {
      case "unauthenticated":
        router.push("/sign-in");
        return;
      case "invalid":
        if (error.field) {
          setFieldErrors({ [error.field]: error.message });
        } else {
          setServerError(error.message);
        }
        return;
    }
  }

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
