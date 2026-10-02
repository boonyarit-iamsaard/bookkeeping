// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { categoryQueries, transactionQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { TransactionDetailLoading } from "@/features/transactions/components/history-loading";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { buttonVariants } from "@/shared/components/ui/button";

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
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Pencil data-icon="inline-start" strokeWidth={1.75} />
            Edit
          </Link>
        }
      />
      <TransactionDetailView transaction={transaction} />
      {transaction.type === "expense" && (
        <ExpenseRefundsSection
          transactionId={transaction.id}
          categoryId={transaction.category?.id}
        />
      )}
    </Page>
  );
}

interface ExpenseRefundsSectionProps {
  transactionId: string;
  categoryId: string | undefined;
}

function ExpenseRefundsSection({
  transactionId,
  categoryId,
}: Readonly<ExpenseRefundsSectionProps>) {
  const colorOf = useCategoryColors();
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(transactionId),
  );
  if (!refunds) {
    throw new Error("The expense refunds query returned no data");
  }
  return (
    <ExpenseRefundsView
      expense={{ id: transactionId }}
      refunds={refunds}
      color={categoryId ? colorOf(categoryId) : "neutral"}
    />
  );
}
