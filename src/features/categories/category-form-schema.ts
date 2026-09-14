import * as z from "zod";
import type { CategoryKind } from "@/features/categories/category.types";
import { CATEGORY_KINDS } from "@/features/categories/category.types";
import {
  CATEGORY_MESSAGES,
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
} from "@/features/categories/category-name";
import { isIconId } from "@/features/categories/icons";

/** The parent select's value for "make this a top-level category". */
export const NO_PARENT = "";
/** The parent select's value for "create the parent along with it". */
export const NEW_PARENT = "new";

/** Trimmed, then bounded: the one name rule for creation and renaming. */
export const categoryNameSchema = z
  .string()
  .transform(normalizeCategoryName)
  .pipe(
    z
      .string()
      .min(1, CATEGORY_MESSAGES.blankName)
      .max(MAX_CATEGORY_NAME_LENGTH, CATEGORY_MESSAGES.nameTooLong),
  );
const nameField = categoryNameSchema;

const iconField = z.string().refine(isIconId, CATEGORY_MESSAGES.unknownIcon);

/**
 * What the create panel holds. The parent select carries one of three
 * things: nothing, an existing parent's id, or the sentinel for a new one.
 */
export const categoryFormSchema = z
  .object({
    name: nameField,
    iconId: iconField,
    parent: z.string(),
    parentName: z.string(),
    parentIconId: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.parent !== NEW_PARENT) {
      return;
    }
    // The new parent's fields only count once it is chosen, so they are
    // checked here with the same rules as the category's own.
    for (const issue of nameField.safeParse(value.parentName).error?.issues ??
      []) {
      ctx.addIssue({
        code: "custom",
        path: ["parentName"],
        message: issue.message,
      });
    }
    if (!isIconId(value.parentIconId)) {
      ctx.addIssue({
        code: "custom",
        path: ["parentIconId"],
        message: CATEGORY_MESSAGES.unknownIcon,
      });
    }
  });

export type CategoryFormInput = z.input<typeof categoryFormSchema>;

/** What the edit sheet holds: the name and icon; level and parent are fixed. */
export const editCategoryFormSchema = z.object({
  name: nameField,
  iconId: iconField,
});

export type EditCategoryFormInput = z.input<typeof editCategoryFormSchema>;

/** What the client actually sends: the tree plus an explicit parent choice. */
export const createCategorySubmissionSchema = z.object({
  kind: z.enum(CATEGORY_KINDS),
  name: nameField,
  iconId: iconField,
  parent: z.union([
    z.null(),
    z.object({ existingId: z.string().min(1) }),
    z.object({ create: z.object({ name: nameField, iconId: iconField }) }),
  ]),
});

export type CreateCategorySubmission = z.input<
  typeof createCategorySubmissionSchema
>;

export function toCreateCategorySubmission(
  kind: CategoryKind,
  values: Readonly<CategoryFormInput>,
): CreateCategorySubmission {
  let parent: CreateCategorySubmission["parent"] = null;
  if (values.parent === NEW_PARENT) {
    parent = {
      create: {
        name: normalizeCategoryName(values.parentName),
        iconId: values.parentIconId,
      },
    };
  } else if (values.parent !== NO_PARENT) {
    parent = { existingId: values.parent };
  }
  return {
    kind,
    name: normalizeCategoryName(values.name),
    iconId: values.iconId,
    parent,
  };
}
