// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { categoryQueries, transactionQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { TransactionDetailLoading } from "@/features/transactions/components/history-loading";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

interface ExpenseRefundsSectionProps {
  transactionId: string;
  categoryId: string | undefined;
  onRecordRefund: (() => void) | null;
}

function ExpenseRefundsSection({
  transactionId,
  categoryId,
  onRecordRefund,
}: Readonly<ExpenseRefundsSectionProps>) {
  const colorOf = useCategoryColors();
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(transactionId),
  );
  return (
    <ExpenseRefundsView
      expense={{ id: transactionId }}
      refunds={refunds}
      color={categoryId ? colorOf(categoryId) : "neutral"}
      onRecordRefund={onRecordRefund}
    />
  );
}

function TransactionDetailPage() {
  const { transactionId } = Route.useParams();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  // From 1024px Edit and Record refund open over this detail.
  const desktop = useIsDesktop();
  const entryDialog = useEntryDialog<"edit" | "refund">();
  const openEdit = desktop ? () => entryDialog.open("edit") : null;
  const openRefund = desktop ? () => entryDialog.open("refund") : null;
  const refunding = entryDialog.entry === "refund";

  return (
    <Page layout="column">
      <TitleBar
        title={TRANSACTION_TYPE_LABELS[transaction.type]}
        back={<BackLink to="/transactions" aria-label="Back to Transactions" />}
        actions={
          <Link
            to="/transactions/$transactionId/edit"
            params={{ transactionId: transaction.id }}
            onClick={openInPlace(openEdit)}
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
          onRecordRefund={openRefund}
        />
      )}
      {entryDialog.saved && (
        <EntrySavedNotice>
          <span className="font-semibold">
            {refunding ? "Refund saved." : "Changes saved."}
          </span>{" "}
          {refunding
            ? "Refunds on this expense include it."
            : "This transaction shows them."}
        </EntrySavedNotice>
      )}
      <EntryDialog
        {...entryDialog.dialog}
        title={
          refunding ? "Record refund" : editTransactionTitle(transaction.type)
        }
        loadError="This form could not load. Try again; nothing has been saved."
      >
        {refunding ? (
          <RecordRefund expenseId={transaction.id} host={entryDialog.host} />
        ) : (
          <EditTransaction
            transactionId={transaction.id}
            host={entryDialog.host}
          />
        )}
      </EntryDialog>
    </Page>
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
