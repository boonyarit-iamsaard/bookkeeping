/**
 * A defensive bound, not a product limit: names around 40 characters are
 * the expected range and the database column is unbounded text.
 */
export const MAX_CATEGORY_NAME_LENGTH = 60;

/** Surrounding whitespace never counts; inner spacing is kept as typed. */
export function normalizeCategoryName(raw: string): string {
  return raw.trim();
}

/** One wording for the form schema and the server rejection. */
export const CATEGORY_MESSAGES = {
  blankName: "Enter a name",
  nameTooLong: `Names can be at most ${MAX_CATEGORY_NAME_LENGTH} characters`,
  unknownIcon: "Choose an icon from the catalog",
} as const;
