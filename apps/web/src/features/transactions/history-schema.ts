import {
  isTransactionListPage,
  TRANSACTION_LIST_ORDERS,
  TRANSACTION_LIST_SORTS,
  TRANSACTION_PAGE_SIZES,
} from "@bookkeeping/domain/transactions";
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
 * The saved id. It is not a filter, so a repeated one drops the highlight
 * rather than marking a row.
 */
const savedIdValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  return typeof value === "number" ? String(value) : undefined;
}, z.string().optional());

/** A number from the address, whether the router read it as text or not. */
function addressNumber(value: unknown) {
  return typeof value === "string" ? Number(value) : value;
}

/**
 * The table's view of the history. A value it cannot show drops to its
 * default rather than reading an invalid page.
 */
const pageNumber = z.preprocess((value) => {
  const number = addressNumber(value);
  return typeof number === "number" && isTransactionListPage(number)
    ? number
    : undefined;
}, z.number().optional());
const pageSize = z.preprocess(
  (value) =>
    TRANSACTION_PAGE_SIZES.find((size) => size === addressNumber(value)),
  z.literal(TRANSACTION_PAGE_SIZES).optional(),
);
const choiceOf = <const T extends readonly [string, ...string[]]>(choices: T) =>
  z.preprocess(
    (value) => choices.find((choice) => choice === value),
    z.enum(choices).optional(),
  );

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
 * invalid filters keep their editable values, plus the table's view and the
 * transaction just saved.
 */
export const historySearchSchema = z.object({
  from: searchValue,
  to: searchValue,
  walletId: searchValue,
  categoryId: searchValue,
  type: searchValue,
  tagId: searchValues,
  page: pageNumber,
  pageSize,
  sort: choiceOf(TRANSACTION_LIST_SORTS),
  order: choiceOf(TRANSACTION_LIST_ORDERS),
  created: savedIdValue,
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
