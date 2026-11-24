import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import { TransactionDetailBody } from "@/features/transactions/components/transaction-detail-body";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";

interface TransactionDetailDesktopProps {
  transaction: components["schemas"]["Transaction"];
}

/** Edit and Record refund open in a dialog over this detail. */
export function TransactionDetailDesktop({
  transaction,
}: Readonly<TransactionDetailDesktopProps>) {
  const entryDialog = useEntryDialog<"edit" | "refund">();
  const refunding = entryDialog.entry === "refund";

  return (
    <Page layout="column">
      <TransactionDetailBody
        transaction={transaction}
        onEdit={() => entryDialog.open("edit")}
        onRecordRefund={() => entryDialog.open("refund")}
      />
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
