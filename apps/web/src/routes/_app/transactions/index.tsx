import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
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
import { historySearchSchema } from "@/features/transactions/history-schema";
import { buildHistoryView } from "@/features/transactions/history-view";
import { SavedNotice } from "@/shared/components/saved-notice";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/transactions/")({
  head: () => ({ meta: [{ title: "Transactions" }] }),
  validateSearch: historySearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const view = buildHistoryView(deps.search);
    await Promise.all([
      view.state === "valid" &&
        context.queryClient.ensureQueryData(transactionQueries.list(view.list)),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(tagQueries.list()),
    ]);
  },
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: TransactionsPage,
});

function TransactionsPage() {
  const search = Route.useSearch();
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
  const transactions = listQuery && page ? page.items : [];
  const nextCursor = listQuery && page ? page.page.nextCursor : null;
  const justDeleted = search.deleted === 1;
  const filterErrors = view.state === "invalid" ? view.errors : [];

  return (
    <Page layout="wide">
      <TitleBar
        title="Transactions"
        actions={
          <HistoryFilters
            wallets={walletCollection.items}
            categories={categoryCollection.items}
            tags={tagCollection.items}
            values={view.values}
            errors={filterErrors}
          />
        }
      />
      <HistoryFilterChips
        wallets={walletCollection.items}
        categories={categoryCollection.items}
        tags={tagCollection.items}
        view={view}
      />
      {justDeleted && (
        <SavedNotice>
          <span className="font-semibold">Transaction deleted.</span> It no
          longer counts toward any wallet balance.
        </SavedNotice>
      )}
      <TransactionHistory
        transactions={transactions}
        filterErrors={filterErrors}
        filtered={view.hasFilters}
        savedId={search.created}
      />
      {nextCursor && (
        <Link
          to="/transactions"
          search={{ ...view.values, cursor: nextCursor }}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "w-full sm:w-auto sm:self-start",
          })}
        >
          Older transactions
        </Link>
      )}
    </Page>
  );
}
