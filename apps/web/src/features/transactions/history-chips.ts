import { formatCalendarDate, isCalendarDate } from "@bookkeeping/domain/dates";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import type {
  HistoryFilterKey,
  HistoryFilterValues,
} from "@/features/transactions/history-schema";
import { HISTORY_FILTER_KEYS } from "@/features/transactions/history-schema";
import type {
  HistoryValueKey,
  HistoryView,
} from "@/features/transactions/history-view";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";

interface Named {
  id: string;
  name: string;
}

interface NamedCategory extends Named {
  parentId: string | null;
}

interface HistoryFilterNames {
  wallets: readonly Named[];
  categories: readonly NamedCategory[];
  tags: readonly Named[];
}

export type HistoryFilterField =
  | "From"
  | "To"
  | "Wallet"
  | "Category"
  | "Type"
  | "Tag";

export interface HistoryFilterChip {
  /** Unique per chip: the filter's key, or `tagId:<id>` for each tag. */
  key: HistoryValueKey;
  /** The phone chip's whole text, such as "From 1 Sep 2026" or "# Coffee". */
  label: string;
  /** The filter's name, which the desktop chip shows before its value. */
  field: HistoryFilterField;
  /** The value alone, such as "1 Sep 2026", "Coffee" or a category's full path. */
  value: string;
  /** The value is not one the history accepts, so it filters nothing. */
  invalid: boolean;
  /** The address with just this filter lifted, back on the first page. */
  without: HistoryFilterValues;
}

function dateLabel(value: string): string {
  return isCalendarDate(value) ? formatCalendarDate(value) : value;
}

function nameOf(items: readonly Named[], id: string): string {
  return items.find((item) => item.id === id)?.name ?? id;
}

/** "Food › Groceries" for a child, as the table names it; an unknown id as typed. */
function categoryPathOf(categories: readonly NamedCategory[], id: string) {
  const category = categories.find((item) => item.id === id);
  const parent = categories.find((item) => item.id === category?.parentId);
  return parent
    ? `${parent.name} › ${nameOf(categories, id)}`
    : nameOf(categories, id);
}

function typeLabel(value: string): string {
  const type = TRANSACTION_TYPES.find((candidate) => candidate === value);
  return type ? TRANSACTION_TYPE_LABELS[type] : value;
}

interface TagChipsOptions {
  filters: Readonly<HistoryFilterValues>;
  tags: readonly Named[];
  invalidKeys: ReadonlySet<HistoryValueKey>;
}

/** One chip per chosen tag, each lifting only its own tag. */
function tagChips({
  filters,
  tags,
  invalidKeys,
}: Readonly<TagChipsOptions>): HistoryFilterChip[] {
  const chosen = filters.tagId ?? [];
  return chosen.map((tagId) => {
    const rest = chosen.filter((other) => other !== tagId);
    const { tagId: _removed, ...others } = filters;
    const key = `tagId:${tagId}` as const;
    const value = nameOf(tags, tagId);
    return {
      key,
      label: `# ${value}`,
      field: "Tag",
      value,
      invalid: invalidKeys.has(key),
      without: rest.length > 0 ? { ...others, tagId: rest } : others,
    };
  });
}

/**
 * One removable chip per active filter, in the sheet's field order. A value
 * the app cannot name (an invalid date, a wallet since deleted) shows as typed.
 */
export function historyFilterChips(
  view: Readonly<HistoryView>,
  names: Readonly<HistoryFilterNames>,
): HistoryFilterChip[] {
  const filters = view.values;
  const invalidKeys: ReadonlySet<HistoryValueKey> =
    view.state === "invalid" ? view.invalidKeys : new Set();
  // Each filter's field and bare value, then the phone label when it differs from the value.
  const chipText: Record<
    HistoryFilterKey,
    (raw: string) => Pick<HistoryFilterChip, "field" | "value"> & {
      label?: string;
    }
  > = {
    from: (raw) => ({
      field: "From",
      value: dateLabel(raw),
      label: `From ${dateLabel(raw)}`,
    }),
    to: (raw) => ({
      field: "To",
      value: dateLabel(raw),
      label: `To ${dateLabel(raw)}`,
    }),
    walletId: (raw) => ({ field: "Wallet", value: nameOf(names.wallets, raw) }),
    categoryId: (raw) => ({
      field: "Category",
      value: categoryPathOf(names.categories, raw),
      label: nameOf(names.categories, raw),
    }),
    type: (raw) => ({ field: "Type", value: typeLabel(raw) }),
  };
  const single = HISTORY_FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    if (!value) {
      return [];
    }
    const { [key]: _removed, ...without } = filters;
    const invalid = invalidKeys.has(key);
    const { field, value: shown, label = shown } = chipText[key](value);
    return [{ key, label, field, value: shown, invalid, without }];
  });
  return [...single, ...tagChips({ filters, tags: names.tags, invalidKeys })];
}
