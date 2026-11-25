import { createFileRoute } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { historySearchSchema } from "@/features/transactions/history-schema";
import {
  buildHistoryView,
  historyReadSearch,
} from "@/features/transactions/history-view";
import {
  TransactionsDesktop,
  TransactionsDesktopLoading,
} from "@/features/transactions/screens/transactions.desktop";
import { TransactionsPhone } from "@/features/transactions/screens/transactions.phone";
import { isDesktopViewport, useIsDesktop } from "@/shared/hooks/use-is-desktop";

function TransactionsPage() {
  const search = Route.useSearch();
  const desktop = useIsDesktop();
  return desktop ? (
    <TransactionsDesktop search={search} />
  ) : (
    <TransactionsPhone search={search} />
  );
}

function TransactionsLoading() {
  return useIsDesktop() ? <TransactionsDesktopLoading /> : <HistoryLoading />;
}

export const Route = createFileRoute("/_app/transactions/")({
  head: () => ({ meta: [{ title: "Transactions" }] }),
  validateSearch: historySearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    // The phone ignores the table's size, sort and order, so it reads without them.
    const view = buildHistoryView(
      historyReadSearch(deps.search, { desktop: isDesktopViewport() }),
    );
    await Promise.all([
      view.state === "valid" &&
        context.queryClient.ensureQueryData(transactionQueries.list(view.list)),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(tagQueries.list()),
    ]);
  },
  pendingComponent: TransactionsLoading,
  errorComponent: HistoryErrorBoundary,
  component: TransactionsPage,
});
