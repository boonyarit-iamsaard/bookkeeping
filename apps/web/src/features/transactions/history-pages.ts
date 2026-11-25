import type { HistorySearch } from "@/features/transactions/history-schema";

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
    cursor: _cursor,
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
