import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { buildHistoryView } from "@/features/transactions/history-view";

/** The reads both Transactions compositions show, from the address's search. */
export function useHistoryReads(search: Readonly<HistorySearch>) {
  const view = buildHistoryView(search);
  const listQuery =
    view.state === "valid" ? transactionQueries.list(view.list) : null;
  // Invalid filters read nothing; a failed re-read shows the error screen.
  const { data: page } = useQuery({
    ...(listQuery ?? transactionQueries.list()),
    enabled: listQuery !== null,
    throwOnError: true,
  });
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  const { data: tagCollection } = useSuspenseQuery(tagQueries.list());
  return {
    view,
    /** Valid filters whose page has not arrived, as after crossing 1024px. */
    pending: listQuery !== null && page === undefined,
    transactions: listQuery && page ? page.items : [],
    /** The filtered list's size. */
    total: listQuery && page ? page.page.total : 0,
    filterErrors: view.state === "invalid" ? view.errors : [],
    wallets: walletCollection.items,
    categories: categoryCollection.items,
    tags: tagCollection.items,
  };
}
