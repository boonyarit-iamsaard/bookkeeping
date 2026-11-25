import { useSuspenseQuery } from "@tanstack/react-query";
import type { components } from "@/core/api/openapi.gen";
import { transactionQueries, walletQueries } from "@/core/api/queries";
import { editableTransaction } from "@/features/transactions/editable-transaction";
import type { TransactionFormProps } from "@/features/transactions/hooks/use-transaction-entry-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import type {
  LinkedExpenseView,
  WalletOption,
} from "@/features/transactions/transaction.types";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { toWalletOptions } from "@/features/transactions/wallet-options";
import type { EntryDialogHost } from "@/shared/components/form/entry-dialog";

type Transaction = components["schemas"]["Transaction"];

/** The edit form's title, on its page and in its dialog. */
export function editTransactionTitle(type: Transaction["type"]): string {
  return `Edit ${TRANSACTION_TYPE_LABELS[type].toLowerCase()}`;
}

interface EditTransactionFormProps {
  transaction: Transaction;
  wallets: readonly WalletOption[];
  host?: EntryDialogHost;
  formComponent: React.ComponentType<TransactionFormProps>;
}

interface EditRefundFormProps extends EditTransactionFormProps {
  expenseId: string;
}

interface EditFormProps extends EditTransactionFormProps {
  refundOf?: LinkedExpenseView;
  refunds?: components["schemas"]["TransactionRefunds"];
}

function EditForm({
  transaction,
  wallets,
  refundOf,
  refunds,
  host,
  formComponent: Form,
}: Readonly<EditFormProps>) {
  return (
    <Form
      wallets={wallets}
      mode={{
        kind: "correct",
        transaction: editableTransaction({ transaction, refundOf, refunds }),
      }}
      host={host}
    />
  );
}

function EditRefundForm({
  expenseId,
  ...props
}: Readonly<EditRefundFormProps>) {
  const { data: expense } = useSuspenseQuery(
    transactionQueries.detail(expenseId),
  );
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(expenseId, { excluding: props.transaction.id }),
  );
  return (
    <EditForm {...props} refundOf={linkedExpenseView({ expense, refunds })} />
  );
}

function EditExpenseForm(props: Readonly<EditTransactionFormProps>) {
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(props.transaction.id),
  );
  return <EditForm {...props} refunds={refunds} />;
}

interface EditTransactionProps {
  transactionId: string;
  host?: EntryDialogHost;
  /** The composition to correct with; the route or dialog host picks it. */
  formComponent: React.ComponentType<TransactionFormProps>;
}

/** The edit form: a refund shows its expense; an expense shows what it has refunded. */
export function EditTransaction({
  transactionId,
  host,
  formComponent,
}: Readonly<EditTransactionProps>) {
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const wallets = toWalletOptions(walletCollection.items, {
    retainedWalletIds: [
      transaction.wallet.id,
      ...(transaction.destinationWallet
        ? [transaction.destinationWallet.id]
        : []),
    ],
  });
  const props = { transaction, wallets, host, formComponent };

  if (transaction.refundOf) {
    return <EditRefundForm {...props} expenseId={transaction.refundOf.id} />;
  }
  if (transaction.type === "expense") {
    return <EditExpenseForm {...props} />;
  }
  return <EditForm {...props} />;
}
