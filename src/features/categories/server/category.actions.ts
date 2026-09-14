"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import type { CategorySummary } from "@/features/categories/category.types";
import {
  categoryNameSchema,
  createCategorySubmissionSchema,
} from "@/features/categories/category-form-schema";
import { CATEGORY_MESSAGES } from "@/features/categories/category-name";
import type {
  CategoryErrorField,
  CreateCategoryError,
} from "@/features/categories/server/category";
import { createCategory } from "@/features/categories/server/category";
import type {
  RemoveCategoryError,
  RemoveCategoryOutcome,
  UpdateCategoryError,
} from "@/features/categories/server/category-management";
import {
  removeCategory,
  updateCategory,
} from "@/features/categories/server/category-management";
import type { Result } from "@/shared/helpers/result";
import { err, ok } from "@/shared/helpers/result";

const CATEGORY_FIELDS = [
  "name",
  "iconId",
  "parent",
  "parentName",
  "parentIconId",
] as const satisfies readonly (CategoryErrorField | "parent")[];
export type CategoryFormField = (typeof CATEGORY_FIELDS)[number];

/** Every error is definitive: the server answered and nothing was saved. */
export type CreateCategoryActionError =
  | { code: "unauthenticated" }
  | { code: "invalid"; field?: CategoryFormField; message: string };

export interface CreateCategoryActionSuccess {
  category: CategorySummary;
  createdParent?: CategorySummary;
}

/**
 * Server Functions are reachable by direct POST, so the session is checked
 * here, not only in the layout. Ownership comes from the session alone; the
 * input carries no user identifier.
 */
export async function createCategoryAction(
  input: unknown,
): Promise<Result<CreateCategoryActionSuccess, CreateCategoryActionError>> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }

  const parsed = createCategorySubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return err({
      code: "invalid",
      field: fieldFromPath(issue?.path ?? []),
      message: issue?.message ?? "Some details were not accepted",
    });
  }

  // Ownership comes last so nothing in the parsed input can override it.
  const outcome = await createCategory(db, {
    ...parsed.data,
    ownerId: session.user.id,
  });
  if (!outcome.ok) {
    return err(describeRejection(outcome.error));
  }

  // The client appends the saved rows itself; the form route is dynamic and
  // re-reads the tree on its next render regardless.
  return ok(outcome.value);
}

/** `["parent", "create", "name"]` is the new parent's name field. */
function fieldFromPath(
  path: readonly PropertyKey[],
): CategoryFormField | undefined {
  const [head, , leaf] = path;
  if (head === "parent") {
    if (leaf === "name") {
      return "parentName";
    }
    if (leaf === "iconId") {
      return "parentIconId";
    }
    return "parent";
  }
  return CATEGORY_FIELDS.find((field) => field === head);
}

function describeRejection(
  error: CreateCategoryError,
): CreateCategoryActionError {
  switch (error.code) {
    case "blank-name":
      return {
        code: "invalid",
        field: error.field,
        message: CATEGORY_MESSAGES.blankName,
      };
    case "name-too-long":
      return {
        code: "invalid",
        field: error.field,
        message: CATEGORY_MESSAGES.nameTooLong,
      };
    case "unknown-icon":
      return {
        code: "invalid",
        field: error.field,
        message: CATEGORY_MESSAGES.unknownIcon,
      };
    case "duplicate-name":
      return {
        code: "invalid",
        field: error.field,
        message: duplicateMessage(error.field),
      };
    case "parent-not-found":
      return {
        code: "invalid",
        field: "parent",
        message: "That parent is not available. Choose another or create one.",
      };
    case "parent-is-child":
      return {
        code: "invalid",
        field: "parent",
        message:
          "A child category cannot hold children. Choose a parent category.",
      };
    case "parent-protected":
      return {
        code: "invalid",
        field: "parent",
        message: "Uncategorized cannot hold children. Choose another parent.",
      };
  }
}

function duplicateMessage(field: CategoryErrorField): string {
  return field === "parentName"
    ? "A category with this name already exists in this tree. Pick it as the parent instead."
    : "A category with this name already exists here. Search for it instead.";
}

const manageCategorySchema = z.discriminatedUnion("operation", [
  z.object({
    id: z.uuid(),
    operation: z.literal("update"),
    name: categoryNameSchema,
    iconId: z.string(),
  }),
  z.object({ id: z.uuid(), operation: z.literal("remove") }),
]);

/** Every error is definitive: the server answered and nothing was changed. */
export type ManageCategoryActionError =
  | { code: "unauthenticated" }
  | { code: "invalid"; field?: "name" | "iconId"; message: string };

export type ManageCategoryActionSuccess =
  | { operation: "update"; category: CategorySummary }
  | ({ operation: "remove" } & RemoveCategoryOutcome);

/** Renames, changes the icon of, or removes one of the session user's categories. */
export async function manageCategoryAction(
  input: unknown,
): Promise<Result<ManageCategoryActionSuccess, ManageCategoryActionError>> {
  const session = await getSession();
  if (!session) {
    return err({ code: "unauthenticated" });
  }
  const parsed = manageCategorySchema.safeParse(input);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    const [head] = issue?.path ?? [];
    return err({
      code: "invalid",
      field: head === "name" || head === "iconId" ? head : undefined,
      message: issue?.message ?? "Some details were not accepted",
    });
  }
  const data = parsed.data;
  const owned = { id: data.id, ownerId: session.user.id };
  if (data.operation === "update") {
    const outcome = await updateCategory(db, {
      ...owned,
      name: data.name,
      iconId: data.iconId,
    });
    if (!outcome.ok) {
      return err(describeUpdateRejection(outcome.error));
    }
    revalidateCategoryViews();
    return ok({ operation: "update", category: outcome.value });
  }
  const outcome = await removeCategory(db, owned);
  if (!outcome.ok) {
    return err(describeRemoveRejection(outcome.error));
  }
  revalidateCategoryViews();
  return ok({ operation: "remove", ...outcome.value });
}

/** Labels appear on every transaction view, so all of them are re-read. */
function revalidateCategoryViews() {
  revalidatePath("/categories");
  revalidatePath("/transactions", "layout");
  revalidatePath("/dashboard");
}

function describeUpdateRejection(
  error: UpdateCategoryError,
): ManageCategoryActionError {
  switch (error.code) {
    case "blank-name":
      return {
        code: "invalid",
        field: "name",
        message: CATEGORY_MESSAGES.blankName,
      };
    case "name-too-long":
      return {
        code: "invalid",
        field: "name",
        message: CATEGORY_MESSAGES.nameTooLong,
      };
    case "unknown-icon":
      return {
        code: "invalid",
        field: "iconId",
        message: CATEGORY_MESSAGES.unknownIcon,
      };
    case "duplicate-name":
      return {
        code: "invalid",
        field: "name",
        message: "A category with this name already exists here.",
      };
    case "protected":
      return {
        code: "invalid",
        field: "name",
        message: "Uncategorized keeps its name. Its icon can still change.",
      };
    case "category-not-found":
      return { code: "invalid", message: CATEGORY_MESSAGES.gone };
  }
}

function describeRemoveRejection(
  error: RemoveCategoryError,
): ManageCategoryActionError {
  switch (error.code) {
    case "protected":
      return {
        code: "invalid",
        message:
          "Uncategorized cannot be removed. It is where removed parents' entries go.",
      };
    case "has-children":
      return {
        code: "invalid",
        message:
          "Remove or rename its child categories first; a parent with children stays.",
      };
    case "in-use":
      return {
        code: "invalid",
        message:
          "An entry was just recorded under this category. Nothing changed; try again.",
      };
    case "category-not-found":
      return { code: "invalid", message: CATEGORY_MESSAGES.gone };
  }
}
