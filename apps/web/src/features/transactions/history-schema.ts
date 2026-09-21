import { parseCalendarDate } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { z } from "zod";

const calendarDate = z
  .string()
  .refine(
    (value) => value >= "0001-01-01" && parseCalendarDate(value).ok,
    "Choose a valid date.",
  );

export const transactionFiltersSchema = z
  .object({
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "From date must be on or before To date.",
  );

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

/**
 * Empty GET controls mean all records. Repeated parameters stay invalid. The
 * router reads `?type=7` as a number; the control still shows that text, so
 * the filter validation can reject it as the legacy page did.
 */
const searchValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
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
  cursor: searchValue,
  created: searchValue,
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

/** The filter controls' raw values alone; the cursor and saved id are not filters. */
export function historyFilters(
  search: Readonly<HistorySearch>,
): Partial<Record<(typeof HISTORY_FILTER_KEYS)[number], string>> {
  return Object.fromEntries(
    HISTORY_FILTER_KEYS.flatMap((key) =>
      search[key] === undefined ? [] : [[key, search[key]]],
    ),
  );
}

/** Whether the address narrows the history at all. */
export function hasHistoryFilters(search: Readonly<HistorySearch>): boolean {
  return HISTORY_FILTER_KEYS.some((key) => Boolean(search[key]));
}
