// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { ApiProblemError } from "@/core/api/problem";
import { transactionQueries } from "@/core/api/queries";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { buttonVariants } from "@/shared/components/ui/button";

const NOT_FOUND_STATUS = 404;

export const Route = createFileRoute("/_app/transactions/$transactionId")({
  head: () => ({ meta: [{ title: "Transaction" }] }),
  loader: async ({ context, params }) => {
    let transaction: components["schemas"]["Transaction"] | undefined;
    try {
      transaction = await context.queryClient.ensureQueryData(
        transactionQueries.detail(params.transactionId),
      );
    } catch (error) {
      // Ownership is part of the lookup: another user's id reads as not found.
      if (
        error instanceof ApiProblemError &&
        error.problem.status === NOT_FOUND_STATUS
      ) {
        throw notFound();
      }
      throw error;
    }
    if (!transaction) {
      throw new Error("The transaction query returned no data");
    }
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">
          {TRANSACTION_TYPE_LABELS[transaction.type]}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            to="/transactions"
            className={buttonVariants({ variant: "ghost" })}
          >
            Back to list
          </Link>
          <a
            href={`/transactions/${transaction.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil data-icon="inline-start" strokeWidth={1.75} />
            Edit
          </a>
        </div>
      </div>
      <TransactionDetailView transaction={transaction} />
      {transaction.type === "expense" && (
        <ExpenseRefundsSection transactionId={transaction.id} />
      )}
    </main>
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
