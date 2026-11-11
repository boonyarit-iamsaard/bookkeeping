import { z } from "zod";
import { searchValue } from "@/shared/helpers/search-value";

/**
 * Every chosen tag's raw text. One value arrives as a string and several as
 * an array, so both read as a list; an empty list is no filter.
 */
const searchValues = z.preprocess((value) => {
  const values = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === "string" && item !== "" ? [item] : [],
  );
  return values.length > 0 ? values : undefined;
}, z.array(z.string()).optional());

/**
 * The page cursor or the saved id. These are not filters, so a repeated one
 * drops to the first page with no highlight rather than reading an invalid page.
 */
const navigationValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  return typeof value === "number" ? String(value) : undefined;
}, z.string().optional());

/**
 * `?deleted=1` after a deletion. The router writes validated search back to
 * the address, so the output stays the number `1`: a string would be quoted.
 */
const deletedFlag = z.preprocess(
  (value) => (value === 1 || value === "1" ? 1 : undefined),
  z.literal(1).optional(),
);

/**
 * The history address as the URL carries it: every control's raw text, so
 * invalid filters keep their editable values, plus the page cursor and the
 * transaction just saved.
 */
export const historySearchSchema = z.object({
  from: searchValue,
  to: searchValue,
  walletId: searchValue,
  categoryId: searchValue,
  type: searchValue,
  tagId: searchValues,
  cursor: navigationValue,
  created: navigationValue,
  deleted: deletedFlag,
});

export type HistorySearch = z.infer<typeof historySearchSchema>;

export const HISTORY_FILTER_KEYS = [
  "from",
  "to",
  "walletId",
  "categoryId",
  "type",
] as const;

export type HistoryFilterKey = (typeof HISTORY_FILTER_KEYS)[number];

/** The raw filter values: one text per single-choice control, and the chosen tags. */
export interface HistoryFilterValues
  extends Partial<Record<HistoryFilterKey, string>> {
  tagId?: string[];
}
