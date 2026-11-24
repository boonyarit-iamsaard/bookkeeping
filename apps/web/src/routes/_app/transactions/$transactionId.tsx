// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { categoryQueries, transactionQueries } from "@/core/api/queries";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { TransactionDetailLoading } from "@/features/transactions/components/history-loading";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TransactionDetailDesktop } from "@/features/transactions/screens/transaction-detail.desktop";
import { TransactionDetailPhone } from "@/features/transactions/screens/transaction-detail.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function TransactionDetailPage() {
  const { transactionId } = Route.useParams();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  return useIsDesktop() ? (
    <TransactionDetailDesktop transaction={transaction} />
  ) : (
    <TransactionDetailPhone transaction={transaction} />
  );
}

export const Route = createFileRoute("/_app/transactions/$transactionId")({
  head: () => ({ meta: [{ title: "Transaction" }] }),
  loader: async ({ context, params }) => {
    const [transaction] = await Promise.all([
      loadOwnedTransaction(context.queryClient, params.transactionId),
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
    if (transaction.type === "expense") {
      await context.queryClient.ensureQueryData(
        transactionQueries.refunds(params.transactionId),
      );
    }
  },
  pendingComponent: TransactionDetailLoading,
  errorComponent: HistoryErrorBoundary,
  component: TransactionDetailPage,
});
