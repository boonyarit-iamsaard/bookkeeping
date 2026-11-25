import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatApiMoneyInput } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { DeleteTransactionDialog } from "@/features/transactions/components/delete-transaction-button";
import {
  EditTransaction,
  editTransactionTitle,
} from "@/features/transactions/components/edit-transaction";
import { RecordRefund } from "@/features/transactions/components/record-refund";
import { TransactionRowMenu } from "@/features/transactions/components/transaction-row-menu";
import { walletName } from "@/features/transactions/components/transaction-table";
import { TransactionFormDesktop } from "@/features/transactions/screens/transaction-form.desktop";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionRowActionsProps {
  children: (
    renderRowActions: (
      transaction: Readonly<ApiTransaction>,
    ) => React.ReactNode,
  ) => React.ReactNode;
}

interface Entry {
  kind: "edit" | "refund";
  transaction: ApiTransaction;
}

/**
 * Gives a table its row menus and what they open: Edit and Refund in the entry
 * dialog over the table, Delete in its confirmation. The table keeps its
 * address, so it shows the saved Correction or Refund where it stands.
 */
export function TransactionRowActions({
  children,
}: Readonly<TransactionRowActionsProps>) {
  const navigate = useNavigate();
  const entryDialog = useEntryDialog<Entry>();
  const [deleting, setDeleting] = useState<ApiTransaction | null>(null);
  const { entry } = entryDialog;
  const refunding = entry?.kind === "refund";

  return (
    <>
      {children((transaction) => (
        <TransactionRowMenu
          transaction={transaction}
          onEdit={() => entryDialog.open({ kind: "edit", transaction })}
          onRefund={() => entryDialog.open({ kind: "refund", transaction })}
          onDelete={() => setDeleting(transaction)}
        />
      ))}
      {entryDialog.saved && (
        <EntrySavedNotice>
          <span className="font-semibold">
            {refunding ? "Refund saved." : "Changes saved."}
          </span>{" "}
          {refunding
            ? "Refunds on that expense include it."
            : "The table shows them."}
        </EntrySavedNotice>
      )}
      <EntryDialog
        {...entryDialog.dialog}
        className="sm:max-w-2xl"
        title={
          refunding
            ? "Record refund"
            : editTransactionTitle(entry?.transaction.type ?? "expense")
        }
        loadError="This form could not load. Try again; nothing has been saved."
      >
        {entry?.kind === "refund" && (
          <RecordRefund
            expenseId={entry.transaction.id}
            host={entryDialog.host}
            formComponent={TransactionFormDesktop}
          />
        )}
        {entry?.kind === "edit" && (
          <EditTransaction
            transactionId={entry.transaction.id}
            host={entryDialog.host}
            formComponent={TransactionFormDesktop}
          />
        )}
      </EntryDialog>
      {deleting && (
        <DeleteTransactionDialog
          key={deleting.id}
          transaction={{
            id: deleting.id,
            type: deleting.type,
            amountText: formatApiMoneyInput(deleting.amount),
            transactionDate: deleting.transactionDate,
          }}
          walletName={walletName(deleting.wallet)}
          destinationWalletName={
            deleting.destinationWallet
              ? walletName(deleting.destinationWallet)
              : undefined
          }
          open
          onOpenChange={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            // Stays on the page and filters it was deleted from.
            return navigate({
              to: ".",
              search: (previous) => ({
                ...previous,
                created: undefined,
                deleted: 1,
              }),
            });
          }}
        />
      )}
    </>
  );
}
