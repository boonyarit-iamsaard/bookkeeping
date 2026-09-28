import { APP_TIME_ZONE, formatInstant } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { formatApiMoneyInput, parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { EditableTransaction } from "@/features/transactions/components/transaction-form";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface EditableTransactionOptions {
  transaction: ApiTransaction;
  /** For a refund: its expense, with the refund's own amount back in the allowance. */
  refundOf?: LinkedExpenseView;
  /** For an expense: its current refunds, if any. */
  refunds?: ApiTransactionRefunds;
}

/** Formats an API transaction as the edit form loads it. */
export function editableTransaction({
  transaction,
  refundOf,
  refunds,
}: Readonly<EditableTransactionOptions>): EditableTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    walletId: transaction.wallet.id,
    // A refund's category is read from its expense, never sent back.
    categoryId: refundOf ? "" : (transaction.category?.id ?? ""),
    destinationWalletId: transaction.destinationWallet?.id ?? "",
    amountText: formatApiMoneyInput(transaction.amount),
    transactionDate: transaction.transactionDate,
    note: transaction.note,
    recordedLabel: formatInstant({
      instant: new Date(transaction.recordedAt),
      timeZone: APP_TIME_ZONE,
    }),
    refundOf,
    refundedLabel:
      refunds && refunds.refunds.length > 0
        ? formatMoney({
            amountInMinorUnits: parseApiMoney(refunds.refundedTotal),
            currency: refunds.refundedTotal.currency,
          })
        : undefined,
  };
}
