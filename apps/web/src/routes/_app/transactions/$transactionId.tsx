// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { transactionQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/transactions/$transactionId")({
  head: () => ({ meta: [{ title: "Transaction" }] }),
  loader: async ({ context, params }) => {
    const transaction = await loadOwnedTransaction(
      context.queryClient,
      params.transactionId,
    );
    if (transaction.type === "expense") {
      await context.queryClient.ensureQueryData(
        transactionQueries.refunds(params.transactionId),
      );
    }
  },
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: TransactionDetailPage,
});

function TransactionDetailPage() {
  const { transactionId } = Route.useParams();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  if (!transaction) {
    throw new Error("The transaction query returned no data");
  }

  return (
    <Page layout="wide">
      <TitleBar
        title={TRANSACTION_TYPE_LABELS[transaction.type]}
        back={<BackLink to="/transactions" aria-label="Back to Transactions" />}
        actions={
          <Link
            to="/transactions/$transactionId/edit"
            params={{ transactionId: transaction.id }}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil data-icon="inline-start" strokeWidth={1.75} />
            Edit
          </Link>
        }
      />
      <TransactionDetailView transaction={transaction} />
      {transaction.type === "expense" && (
        <ExpenseRefundsSection transactionId={transaction.id} />
      )}
    </Page>
  );
}

function ExpenseRefundsSection({
  transactionId,
}: Readonly<{ transactionId: string }>) {
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(transactionId),
  );
  if (!refunds) {
    throw new Error("The expense refunds query returned no data");
  }
  return (
    <ExpenseRefundsView expense={{ id: transactionId }} refunds={refunds} />
  );
}
