import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import type {
  HistoryFilterKey,
  HistoryFilterValues,
  HistorySearch,
} from "@/features/transactions/history-schema";
import {
  calendarDate,
  HISTORY_FILTER_KEYS,
  historyFilters,
  transactionFiltersSchema,
} from "@/features/transactions/history-schema";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";

interface Named {
  id: string;
  name: string;
}

interface HistoryFilterNames {
  wallets: readonly Named[];
  categories: readonly Named[];
  tags: readonly Named[];
}

export interface HistoryFilterChip {
  /** Unique per chip: the filter's key, or `tagId:<id>` for each tag. */
  key: HistoryFilterKey | `tagId:${string}`;
  label: string;
  /** The value is not one the history accepts, so it filters nothing. */
  invalid: boolean;
  /** The address with just this filter lifted, back on the first page. */
  without: HistoryFilterValues;
}

function dateLabel(value: string): string {
  const parsed = calendarDate.safeParse(value);
  return parsed.success ? formatCalendarDate(parsed.data) : value;
}

function nameOf(items: readonly Named[], id: string): string {
  return items.find((item) => item.id === id)?.name ?? id;
}

function typeLabel(value: string): string {
  const type = TRANSACTION_TYPES.find((candidate) => candidate === value);
  return type ? TRANSACTION_TYPE_LABELS[type] : value;
}

/** One chip per chosen tag, each lifting only its own tag. */
function tagChips(
  filters: Readonly<HistoryFilterValues>,
  tags: readonly Named[],
): HistoryFilterChip[] {
  const chosen = filters.tagId ?? [];
  return chosen.map((tagId) => {
    const rest = chosen.filter((other) => other !== tagId);
    const { tagId: _removed, ...others } = filters;
    return {
      key: `tagId:${tagId}`,
      label: `# ${nameOf(tags, tagId)}`,
      invalid: !transactionFiltersSchema.safeParse({ tagId: [tagId] }).success,
      without: rest.length > 0 ? { ...others, tagId: rest } : others,
    };
  });
}

/**
 * One removable chip per active filter, in the sheet's field order. A value
 * the app cannot name (an invalid date, a wallet since deleted) shows as typed.
 */
export function historyFilterChips(
  search: Readonly<HistorySearch>,
  names: Readonly<HistoryFilterNames>,
): HistoryFilterChip[] {
  const filters = historyFilters(search);
  const labels: Record<HistoryFilterKey, (value: string) => string> = {
    from: (value) => `From ${dateLabel(value)}`,
    to: (value) => `To ${dateLabel(value)}`,
    walletId: (value) => nameOf(names.wallets, value),
    categoryId: (value) => nameOf(names.categories, value),
    type: typeLabel,
  };
  const single = HISTORY_FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    if (!value) {
      return [];
    }
    const { [key]: _removed, ...without } = filters;
    const invalid = !transactionFiltersSchema.safeParse({ [key]: value })
      .success;
    return [{ key, label: labels[key](value), invalid, without }];
  });
  return [...single, ...tagChips(filters, names.tags)];
}
