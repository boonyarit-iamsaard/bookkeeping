import { isCalendarDate } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { z } from "zod";
import type { TransactionListQuery } from "@/core/api/queries";
import type {
  HistoryFilterKey,
  HistoryFilterValues,
  HistorySearch,
} from "@/features/transactions/history-schema";
import { HISTORY_FILTER_KEYS } from "@/features/transactions/history-schema";

const calendarDate = z.string().refine(isCalendarDate);

/** A client hint mirroring the server's list query shape. */
const transactionFiltersSchema = z
  .object({
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    // Repeated: a transaction carrying any of them matches.
    tagId: z.array(z.uuid()).min(1).optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "From date must be on or before To date.",
  );

const HISTORY_FIELDS = [...HISTORY_FILTER_KEYS, "tagId"] as const;

type HistoryField = (typeof HISTORY_FIELDS)[number];

const FILTER_ERROR_MESSAGES = {
  from: "Choose a valid From date.",
  to: "Choose a valid To date.",
  walletId: "Choose a valid wallet.",
  categoryId: "Choose a valid category.",
  type: "Choose a valid type.",
  tagId: "Choose tags from the list.",
} as const satisfies Record<HistoryField, string>;

/** One key per filter value: the control's key, or `tagId:<id>` for each chosen tag. */
export type HistoryValueKey = HistoryFilterKey | `tagId:${string}`;

interface HistoryViewBase {
  /** The filter controls' raw values; the cursor and saved id are not filters. */
  values: HistoryFilterValues;
  /** Whether the address narrows the history at all, valid or not. */
  hasFilters: boolean;
}

interface ValidHistoryView extends HistoryViewBase {
  state: "valid";
  /** The page of transactions the address names. */
  list: TransactionListQuery;
}

/** Invalid filters have no list query, so they read nothing. */
interface InvalidHistoryView extends HistoryViewBase {
  state: "invalid";
  /** One message per malformed field, or the date order. */
  errors: readonly string[];
  /** The values the history does not accept; a reversed range marks neither date. */
  invalidKeys: ReadonlySet<HistoryValueKey>;
}

export type HistoryView = ValidHistoryView | InvalidHistoryView;

function filterValues(search: Readonly<HistorySearch>): HistoryFilterValues {
  const values: HistoryFilterValues = Object.fromEntries(
    HISTORY_FILTER_KEYS.flatMap((key) =>
      search[key] === undefined ? [] : [[key, search[key]]],
    ),
  );
  return search.tagId?.length
    ? { ...values, tagId: [...search.tagId] }
    : values;
}

interface IssueValue {
  field: HistoryField | undefined;
  path: readonly PropertyKey[];
  values: Readonly<HistoryFilterValues>;
}

/** The key of the value an issue names, or none for a cross-field issue. */
function valueKeyOf({
  field,
  path,
  values,
}: Readonly<IssueValue>): HistoryValueKey | undefined {
  if (field !== "tagId") {
    return field;
  }
  const index = path[1];
  const tagId = typeof index === "number" ? values.tagId?.[index] : undefined;
  return tagId === undefined ? undefined : `tagId:${tagId}`;
}

/** The history address parsed once: its filter values and either the list to read or what is wrong. */
export function buildHistoryView(search: Readonly<HistorySearch>): HistoryView {
  const values = filterValues(search);
  const hasFilters = Object.keys(values).length > 0;
  const result = transactionFiltersSchema.safeParse(values);
  if (result.success) {
    return {
      state: "valid",
      values,
      hasFilters,
      list: { ...result.data, cursor: search.cursor },
    };
  }
  const errors = new Set<string>();
  const invalidKeys = new Set<HistoryValueKey>();
  for (const issue of result.error.issues) {
    const field = HISTORY_FIELDS.find((key) => key === issue.path[0]);
    errors.add(field ? FILTER_ERROR_MESSAGES[field] : issue.message);
    const key = valueKeyOf({ field, path: issue.path, values });
    if (key !== undefined) {
      invalidKeys.add(key);
    }
  }
  return {
    state: "invalid",
    values,
    hasFilters,
    errors: [...errors],
    invalidKeys,
  };
}
