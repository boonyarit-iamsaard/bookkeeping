import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import {
  TransactionAmount,
  TransactionFacts,
} from "@/features/transactions/components/transaction-detail";
import {
  EditTransactionLink,
  ExpenseRefundsSection,
} from "@/features/transactions/components/transaction-detail-actions";
import { TransactionFormDesktop } from "@/features/transactions/screens/transaction-form.desktop";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";
import { listCardClass } from "@/shared/components/list-section";
import { HeroSkeleton, Skeleton } from "@/shared/components/skeleton";

interface TransactionDetailDesktopProps {
  transaction: components["schemas"]["Transaction"];
}

const DETAIL_GRID =
  "grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-8";

/** Edit and Record refund open in a dialog over this detail. */
export function TransactionDetailDesktop({
  transaction,
}: Readonly<TransactionDetailDesktopProps>) {
  const entryDialog = useEntryDialog<"edit" | "refund">();
  const refunding = entryDialog.entry === "refund";

  return (
    <Page layout="wide">
      <TitleBar
        title={TRANSACTION_TYPE_LABELS[transaction.type]}
        back={<BackLink to="/transactions" aria-label="Back to Transactions" />}
        actions={
          <EditTransactionLink
            transactionId={transaction.id}
            onOpen={() => entryDialog.open("edit")}
          />
        }
      />
      <div className={DETAIL_GRID}>
        <div className="min-w-0">
          <TransactionAmount transaction={transaction} />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <TransactionFacts transaction={transaction} />
          {transaction.type === "expense" && (
            <ExpenseRefundsSection
              transactionId={transaction.id}
              categoryId={transaction.category?.id}
              onRecordRefund={() => entryDialog.open("refund")}
            />
          )}
        </div>
      </div>
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
        className="sm:max-w-2xl"
      >
        {refunding ? (
          <RecordRefund
            expenseId={transaction.id}
            host={entryDialog.host}
            formComponent={TransactionFormDesktop}
          />
        ) : (
          <EditTransaction
            transactionId={transaction.id}
            host={entryDialog.host}
            formComponent={TransactionFormDesktop}
          />
        )}
      </EntryDialog>
    </Page>
  );
}

export function TransactionDetailDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title={<Skeleton className="h-8 w-48" />} />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className={DETAIL_GRID}>
        <HeroSkeleton />
        <div className={listCardClass}>
          {["category", "wallet", "date", "note", "recorded"].map((row) => (
            <div
              key={row}
              className="flex min-h-16 items-center gap-6 px-7 py-3"
            >
              <div className="w-28 shrink-0">
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
