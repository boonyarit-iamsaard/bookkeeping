import { APP_TIME_ZONE, formatInstant } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { formatApiMoneyInput, parseApiMoney } from "@/core/api/api-money";
import type { components } from "@/core/api/openapi.gen";
import type { EditableTransaction } from "@/features/transactions/components/transaction-form";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";
import type { ExpenseRefundLimits } from "@/features/transactions/transaction-form-schema";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface EditableTransactionOptions {
  transaction: ApiTransaction;
  /** For a refund: its expense, with the refund's own amount back in the allowance. */
  refundOf?: LinkedExpenseView;
  /** For an expense: its current refunds, if any. */
  refunds?: ApiTransactionRefunds;
}

/**
 * What an expense's refunds hold a correction to. The API lists refunds
 * oldest transaction date first, so the first is the one the date cannot pass.
 */
export function expenseRefundLimits(
  refunds: Readonly<ApiTransactionRefunds>,
): ExpenseRefundLimits | undefined {
  const [earliest] = refunds.refunds;
  if (!earliest) {
    return undefined;
  }
  return {
    refundedTotal: parseApiMoney(refunds.refundedTotal),
    earliestRefundDate: earliest.transactionDate,
  };
}

/** Formats an API transaction as the edit form loads it. */
export function editableTransaction({
  transaction,
  refundOf,
  refunds,
}: Readonly<EditableTransactionOptions>): EditableTransaction {
  const expenseRefunds = refunds ? expenseRefundLimits(refunds) : undefined;
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
    refundedLabel: expenseRefunds
      ? formatMoney({
          amountInMinorUnits: expenseRefunds.refundedTotal,
          currency: transaction.amount.currency,
        })
      : undefined,
    expenseRefunds,
  };
}
