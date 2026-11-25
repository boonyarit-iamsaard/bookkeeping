import type { HistorySearch } from "@/features/transactions/history-schema";
import { DEFAULT_HISTORY_PAGE_SIZE } from "@/features/transactions/history-view";

/** How the table shows the history: which page, how many rows, in what order. */
export type HistoryTableSettings = Pick<
  HistorySearch,
  "page" | "pageSize" | "sort" | "order"
>;

/**
 * The settings a filter change keeps. The page goes, so new filters start on
 * page 1 rather than one that may no longer exist.
 */
export function historyTableSettings({
  pageSize,
  sort,
  order,
}: Readonly<HistorySearch>): HistoryTableSettings {
  return Object.fromEntries(
    Object.entries({ pageSize, sort, order }).filter(
      ([, value]) => value !== undefined,
    ),
  );
}

/**
 * The address after one table control. Moving page keeps the rest; any other
 * change returns to page 1. Page 1, the saved highlight and the deletion
 * notice leave the address.
 */
export function changeHistoryTable(
  search: Readonly<HistorySearch>,
  change: Readonly<HistoryTableSettings>,
): HistorySearch {
  const {
    page: _currentPage,
    created: _created,
    deleted: _deleted,
    ...rest
  } = search;
  const { page: nextPage, ...settings } = change;
  return {
    ...rest,
    ...settings,
    ...(nextPage !== undefined && nextPage > 1 && { page: nextPage }),
  };
}

/** The address after a type tab: that type, or none for All, from page 1. */
export function changeHistoryType(
  search: Readonly<HistorySearch>,
  type: string | undefined,
): HistorySearch {
  const { type: _previous, ...rest } = changeHistoryTable(search, {});
  return type === undefined ? rest : { ...rest, type };
}

/** The page after the one the address shows, or none when it shows the last. */
export function olderHistoryPage(
  { page = 1, pageSize = DEFAULT_HISTORY_PAGE_SIZE }: Readonly<HistorySearch>,
  total: number,
): number | undefined {
  return page * pageSize < total ? page + 1 : undefined;
}
