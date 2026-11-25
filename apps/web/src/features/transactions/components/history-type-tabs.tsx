import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { TransactionListQuery } from "@/core/api/queries";
import { transactionQueries } from "@/core/api/queries";
import { changeHistoryType } from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import type { HistoryView } from "@/features/transactions/history-view";
import { cn } from "@/shared/helpers/cn";

const TABS = [
  { type: undefined, label: "All" },
  { type: "expense", label: "Expenses" },
  { type: "income", label: "Income" },
  { type: "transfer", label: "Transfers" },
] as const;

interface HistoryTypeTabsProps {
  search: HistorySearch;
  view: HistoryView;
}

/** The list's filters without its type, order or page. */
function countFilters({
  type: _type,
  page: _page,
  pageSize: _pageSize,
  sort: _sort,
  order: _order,
  ...filters
}: TransactionListQuery) {
  return filters;
}

/**
 * Each tab's count under the other filters, read as the smallest page for
 * its total alone. Invalid filters read nothing, so no tab counts.
 * shortcut: four list reads per filter change; add a counts endpoint if they prove slow.
 */
function useTypeCounts(view: HistoryView) {
  const filters = view.state === "valid" ? countFilters(view.list) : null;
  return useQueries({
    queries: TABS.map(({ type }) => ({
      ...transactionQueries.list({
        ...filters,
        type,
        page: "1",
        pageSize: "10",
      }),
      enabled: filters !== null,
      select: (page: { page: { total: number } }) => page.page.total,
    })),
  }).map((result) => result.data);
}

/** All, Expenses, Income and Transfers: the type filter as one click, with counts. */
export function HistoryTypeTabs({
  search,
  view,
}: Readonly<HistoryTypeTabsProps>) {
  const counts = useTypeCounts(view);
  return (
    <nav aria-label="Transaction type">
      <ul className="flex items-center gap-1">
        {TABS.map(({ type, label }, index) => {
          const current = search.type === type;
          const count = counts[index];
          return (
            <li key={label}>
              <Link
                to="/transactions"
                search={changeHistoryType(search, type)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/45 inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold outline-none focus-visible:ring-[3px]",
                  current
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
                {count !== undefined && (
                  <span className="font-medium tabular-nums">
                    {count.toLocaleString("en-US")}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
