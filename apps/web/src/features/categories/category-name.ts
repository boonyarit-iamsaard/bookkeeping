import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";

export {
  MAX_CATEGORY_NAME_LENGTH,
  normalizeCategoryName,
} from "@bookkeeping/domain/categories";

/** One wording for the form schema and the server rejection. */
export const CATEGORY_MESSAGES = {
  blankName: "Enter a name",
  nameTooLong: `Names can be at most ${MAX_CATEGORY_NAME_LENGTH} characters`,
  unknownIcon: "Choose an icon from the catalog",
  gone: "This category is no longer available. Reload to see the current tree.",
} as const;
