import { formatMoney, formatMoneyInput } from "@bookkeeping/domain/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface LinkedExpenseViewOptions {
  expense: ApiTransaction;
  refunds: ApiTransactionRefunds;
  /** The refund being edited, whose own amount is added back to the allowance. */
  editingRefund?: Pick<ApiTransaction, "amount">;
}

/** Formats an API expense and its server-provided allowance for the refund form. */
export function linkedExpenseView({
  expense,
  refunds,
  editingRefund,
}: Readonly<LinkedExpenseViewOptions>): LinkedExpenseView {
  const refundAllowance =
    parseApiMoney(refunds.refundAllowance) +
    (editingRefund ? parseApiMoney(editingRefund.amount) : 0n);
  return {
    id: expense.id,
    amountLabel: formatMoney({
      amountInMinorUnits: parseApiMoney(expense.amount),
      currency: expense.amount.currency,
    }),
    transactionDate: expense.transactionDate,
    categoryLabel: expense.category
      ? categoryLabel(expense.category)
      : "Uncategorized",
    categoryIconId: expense.category?.iconId ?? "",
    wallet: {
      id: expense.wallet.id,
      name: expense.wallet.name,
      archived: expense.wallet.archived,
    },
    refundAllowanceText: formatMoneyInput({
      amountInMinorUnits: refundAllowance,
      currency: refunds.refundAllowance.currency,
    }),
    refundAllowanceLabel: formatMoney({
      amountInMinorUnits: refundAllowance,
      currency: refunds.refundAllowance.currency,
    }),
  };
}
