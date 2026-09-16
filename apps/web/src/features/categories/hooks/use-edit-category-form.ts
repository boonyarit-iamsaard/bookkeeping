"use client";

import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CategorySummary } from "@/features/categories/category.types";
import type { EditCategoryFormInput } from "@/features/categories/category-form-schema";
import { editCategoryFormSchema } from "@/features/categories/category-form-schema";
import type {
  ManageCategoryActionError,
  ManageCategoryActionSuccess,
  ManageCategoryInput,
} from "@/features/categories/server/category.actions";
import { manageCategoryAction } from "@/features/categories/server/category.actions";

interface UseEditCategoryFormOptions {
  category: CategorySummary;
  onDone: (outcome: ManageCategoryActionSuccess) => void;
}

type EditField = keyof EditCategoryFormInput;

const CONNECTION_MESSAGE =
  "The change could not be confirmed. Your values are kept; try again.";

/**
 * One sheet, two outcomes: Save sends the name and icon; Remove sends the
 * removal. Either answer is definitive, so a rejection lands on its field
 * or in the bar and nothing on the page changes until the server says so.
 */
export function useEditCategoryForm({
  category,
  onDone,
}: Readonly<UseEditCategoryFormOptions>) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<EditField, string>>
  >({});
  const [removing, startRemoval] = useTransition();

  const defaultValues: EditCategoryFormInput = {
    name: category.name,
    iconId: category.iconId,
  };

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: editCategoryFormSchema },
    onSubmit: ({ value }) =>
      send({ id: category.id, operation: "update", ...value }),
  });

  function remove() {
    startRemoval(() => send({ id: category.id, operation: "remove" }));
  }

  /** One round trip for either button; the answer lands in the same places. */
  async function send(input: ManageCategoryInput) {
    setServerError(null);
    setFieldErrors({});
    let result: Awaited<ReturnType<typeof manageCategoryAction>>;
    try {
      result = await manageCategoryAction(input);
    } catch {
      setServerError(CONNECTION_MESSAGE);
      return;
    }
    if (!result.ok) {
      applyRejection(result.error);
      return;
    }
    onDone(result.value);
  }

  function applyRejection(error: ManageCategoryActionError) {
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

  function clearFieldError(field: EditField) {
    setFieldErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  }

  return { form, serverError, fieldErrors, clearFieldError, remove, removing };
}
