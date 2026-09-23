import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import {
  HistoryFilterChips,
  HistoryFilters,
} from "@/features/transactions/components/history-filters";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import type { HistorySearch } from "@/features/transactions/history-schema";
import {
  hasHistoryFilters,
  historyFilters,
  historySearchSchema,
  transactionFiltersSchema,
} from "@/features/transactions/history-schema";
import { buttonVariants } from "@/shared/components/ui/button";

/** The page the address names, or null while its filters are invalid. */
function historyListQuery(search: Readonly<HistorySearch>) {
  const parsed = transactionFiltersSchema.safeParse(historyFilters(search));
  return parsed.success
    ? transactionQueries.list({ ...parsed.data, cursor: search.cursor })
    : null;
}

export const Route = createFileRoute("/_app/transactions/")({
  head: () => ({ meta: [{ title: "Transactions" }] }),
  validateSearch: historySearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const listQuery = historyListQuery(deps.search);
    await Promise.all([
      listQuery && context.queryClient.ensureQueryData(listQuery),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
  },
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: TransactionsPage,
});

function TransactionsPage() {
  const search = Route.useSearch();
  const listQuery = historyListQuery(search);
  // Invalid filters read nothing; a failed re-read shows the error screen.
  const { data: page } = useQuery({
    ...(listQuery ?? transactionQueries.list()),
    enabled: listQuery !== null,
    throwOnError: true,
  });
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  if (!walletCollection || !categoryCollection) {
    throw new Error("The history queries returned no data");
  }
  const transactions = listQuery && page ? page.items : [];
  const nextCursor = listQuery && page ? page.page.nextCursor : null;
  const justDeleted = search.deleted === 1;
  const filtered = hasHistoryFilters(search);

  return (
    <Page layout="wide">
      <TitleBar
        title="Transactions"
        actions={
          <HistoryFilters
            wallets={walletCollection.items}
            categories={categoryCollection.items}
            values={search}
            valid={listQuery !== null}
          />
        }
      />
      <HistoryFilterChips
        wallets={walletCollection.items}
        categories={categoryCollection.items}
        values={search}
      />
      {justDeleted && (
        <output className="rounded-xl border bg-muted px-4 py-3 text-sm leading-normal">
          <span className="font-medium">Transaction deleted.</span>{" "}
          <span className="text-muted-foreground">
            It no longer counts toward any wallet balance.
          </span>
        </output>
      )}
      <TransactionHistory
        transactions={transactions}
        filtersValid={listQuery !== null}
        filtered={filtered}
        savedId={search.created}
      />
      {nextCursor && (
        <Link
          to="/transactions"
          search={{ ...historyFilters(search), cursor: nextCursor }}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "self-start",
          })}
        >
          Older transactions
        </Link>
      )}
    </Page>
  );
}
