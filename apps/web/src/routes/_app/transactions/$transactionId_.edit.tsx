// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { carriesOwnTags } from "@bookkeeping/domain/transactions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TransactionFormDesktop } from "@/features/transactions/screens/transaction-form.desktop";
import { TransactionFormPhone } from "@/features/transactions/screens/transaction-form.phone";
import { buttonVariants } from "@/shared/components/ui/button";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function EditTransactionPage() {
  const { transactionId } = Route.useParams();
  const desktop = useIsDesktop();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );

  return (
    <Page layout={desktop ? "column" : "entry"}>
      <TitleBar
        title={editTransactionTitle(transaction.type)}
        back={
          <BackLink
            to="/transactions/$transactionId"
            params={{ transactionId: transaction.id }}
            aria-label="Back to transaction"
          />
        }
        actions={
          // The desktop form's footer carries Cancel.
          !desktop && (
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: transaction.id }}
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "-mr-3",
              })}
            >
              Cancel
            </Link>
          )
        }
      />
      <EditTransaction
        transactionId={transaction.id}
        formComponent={desktop ? TransactionFormDesktop : TransactionFormPhone}
      />
    </Page>
  );
}

export const Route = createFileRoute("/_app/transactions/$transactionId_/edit")(
  {
    head: () => ({ meta: [{ title: "Edit transaction" }] }),
    loader: async ({ context, params }) => {
      const transaction = await loadOwnedTransaction(
        context.queryClient,
        params.transactionId,
      );

      // A refund shows its expense; an expense shows what it has refunded.
      const refundedExpenseId = transaction.refundOf?.id ?? transaction.id;
      await Promise.all([
        context.queryClient.ensureQueryData(walletQueries.list()),
        context.queryClient.ensureQueryData(categoryQueries.list()),
        carriesOwnTags(transaction)
          ? context.queryClient.ensureQueryData(tagQueries.list())
          : undefined,
        transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.detail(refundedExpenseId),
            )
          : undefined,
        transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.refunds(refundedExpenseId, {
                excluding: transaction.id,
              }),
            )
          : undefined,
        transaction.type === "expense"
          ? context.queryClient.ensureQueryData(
              transactionQueries.refunds(transaction.id),
            )
          : undefined,
      ]);
    },
    staticData: { form: true },
    pendingComponent: HistoryLoading,
    errorComponent: HistoryErrorBoundary,
    component: EditTransactionPage,
  },
);
