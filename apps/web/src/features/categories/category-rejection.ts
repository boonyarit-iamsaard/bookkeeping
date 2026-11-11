import { createFieldOf, pointerSegments } from "@/core/api/field-pointer";
import type { components } from "@/core/api/openapi.gen";
import {
  createBlockerDescriber,
  createFieldErrorDescriber,
} from "@/core/api/rejection-wording";
import type { ApiFieldError } from "@/core/api/write-submission";
import type { CategoryFormInput } from "@/features/categories/category-form-schema";
import { CATEGORY_MESSAGES } from "@/features/categories/category-name";

/** Every reason the API refuses a category input, as it publishes them. */
export type CategoryRejectionCode =
  components["schemas"]["CategoryRuleFieldError"]["code"];

/** Every reason the API blocks removing a category, as it publishes them. */
export type CategoryBlockerCode =
  components["schemas"]["CategoryRemovalProblem"]["code"];

// Keyed by every published code, so a new or renamed one fails to compile
// until it has a message.
const CATEGORY_FIELD_MESSAGES: Record<CategoryRejectionCode, string> = {
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
  protected: "Uncategorized keeps its name. Its icon can still change.",
};

const CATEGORY_BLOCKER_MESSAGES: Record<CategoryBlockerCode, string> = {
  protected:
    "Uncategorized cannot be removed. It is where removed parents' entries go.",
  "has-children":
    "Remove or rename its child categories first; a parent with children stays.",
  "in-use":
    "An entry was just recorded under this category. Nothing changed; try again.",
};

const DUPLICATE_PARENT_MESSAGE =
  "A category with this name already exists in this tree. Pick it as the parent instead.";

const describeFieldErrorByCode = createFieldErrorDescriber(
  CATEGORY_FIELD_MESSAGES,
);

/**
 * The message beside a refused category input, in the product's words. A
 * duplicate name under the parent's address means the parent exists already.
 */
export function describeCategoryFieldError(
  fieldError: Readonly<ApiFieldError>,
): string {
  if (
    fieldError.code === "duplicate-name" &&
    pointerSegments(fieldError.pointer)[0] === "parent"
  ) {
    return DUPLICATE_PARENT_MESSAGE;
  }
  return describeFieldErrorByCode(fieldError);
}

/** The error-bar message for a refused category write. */
export const describeCategoryRejection = createBlockerDescriber(
  CATEGORY_BLOCKER_MESSAGES,
);

/** The create form's fields, each addressed by the request field it fills. */
export const CATEGORY_FORM_FIELDS = [
  "name",
  "iconId",
  "parent",
  "parentName",
  "parentIconId",
] as const satisfies readonly (keyof CategoryFormInput)[];

/** The create form field a refused input's pointer addresses. */
export const categoryFieldOf = createFieldOf(CATEGORY_FORM_FIELDS, {
  parentName: "#/parent/create/name",
  parentIconId: "#/parent/create/iconId",
});
