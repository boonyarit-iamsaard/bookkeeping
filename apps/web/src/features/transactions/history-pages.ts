import type {
  HistorySearch,
  HistoryTableSettings,
} from "@/features/transactions/history-schema";
import { historyPageSize } from "@/features/transactions/history-view";

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
  search: Readonly<HistorySearch>,
  total: number,
): number | undefined {
  const { page = 1 } = search;
  return page * historyPageSize(search) < total ? page + 1 : undefined;
}

/** The recovery page when the address is past the end, or undefined on a valid page. */
export function lastHistoryPage(
  search: Readonly<HistorySearch>,
  total: number,
): number | undefined {
  const lastPage = Math.max(1, Math.ceil(total / historyPageSize(search)));
  return (search.page ?? 1) > lastPage ? lastPage : undefined;
}
