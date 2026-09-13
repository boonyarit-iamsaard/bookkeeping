"use server";

import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { createCategorySubmissionSchema } from "@/features/categories/category-form-schema";
import { CATEGORY_MESSAGES } from "@/features/categories/category-name";
import type {
  CategoryErrorField,
  CategorySummary,
  CreateCategoryError,
} from "@/features/categories/server/operations";
import { createCategory } from "@/features/categories/server/operations";
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
