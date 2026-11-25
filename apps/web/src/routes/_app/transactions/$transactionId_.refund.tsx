// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TransactionFormDesktop } from "@/features/transactions/screens/transaction-form.desktop";
import { TransactionFormPhone } from "@/features/transactions/screens/transaction-form.phone";
import { buttonVariants } from "@/shared/components/ui/button";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function RefundPage() {
  const { transactionId } = Route.useParams();
  const desktop = useIsDesktop();

  return (
    <Page layout={desktop ? "column" : "entry"}>
      <TitleBar
        title="Record refund"
        back={
          <BackLink
            to="/transactions/$transactionId"
            params={{ transactionId }}
            aria-label="Back to transaction"
          />
        }
        actions={
          // The desktop form's footer carries Cancel.
          !desktop && (
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId }}
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
      <RecordRefund
        expenseId={transactionId}
        formComponent={desktop ? TransactionFormDesktop : TransactionFormPhone}
      />
    </Page>
  );
}

export const Route = createFileRoute(
  "/_app/transactions/$transactionId_/refund",
)({
  head: () => ({ meta: [{ title: "Record refund" }] }),
  loader: async ({ context, params }) => {
    const expense = await loadOwnedTransaction(
      context.queryClient,
      params.transactionId,
    );
    if (expense.type !== "expense") {
      throw notFound();
    }
    await Promise.all([
      context.queryClient.ensureQueryData(
        transactionQueries.refunds(params.transactionId),
      ),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
  },
  staticData: { form: true },
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: RefundPage,
});
