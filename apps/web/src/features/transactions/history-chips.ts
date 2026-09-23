import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import type { HistorySearch } from "@/features/transactions/history-schema";
import {
  calendarDate,
  HISTORY_FILTER_KEYS,
  historyFilters,
} from "@/features/transactions/history-schema";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";

type HistoryFilterKey = (typeof HISTORY_FILTER_KEYS)[number];

interface Named {
  id: string;
  name: string;
}

interface HistoryFilterNames {
  wallets: readonly Named[];
  categories: readonly Named[];
}

export interface HistoryFilterChip {
  key: HistoryFilterKey;
  label: string;
  /** The address with just this filter lifted, back on the first page. */
  without: HistorySearch;
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
  return HISTORY_FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    if (!value) {
      return [];
    }
    const { [key]: _removed, ...without } = filters;
    return [{ key, label: labels[key](value), without }];
  });
}
