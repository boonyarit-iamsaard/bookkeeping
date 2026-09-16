import { formatMoney, formatMoneyInput } from "@bookkeeping/domain/money";
import { categoryLabel } from "@/features/categories/category-search";
import type {
  ExpenseRefunds,
  LinkedExpenseView,
  TransactionDetail,
} from "@/features/transactions/transaction.types";

interface LinkedExpenseViewOptions {
  expense: TransactionDetail;
  refunds: ExpenseRefunds;
  /** The refund being edited, whose own amount is added back to the allowance. */
  editingRefund?: Pick<TransactionDetail, "amount">;
}

/** Formats an expense for the refund form; figures cross to the client as text. */
export function linkedExpenseView({
  expense,
  refunds,
  editingRefund,
}: Readonly<LinkedExpenseViewOptions>): LinkedExpenseView {
  const remaining = refunds.remaining + (editingRefund?.amount ?? 0n);
  return {
    id: expense.id,
    amountLabel: formatMoney({
      amountInMinorUnits: expense.amount,
      currency: expense.currency,
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
    remainingText: formatMoneyInput({
      amountInMinorUnits: remaining,
      currency: expense.currency,
    }),
    remainingLabel: formatMoney({
      amountInMinorUnits: remaining,
      currency: expense.currency,
    }),
  };
}
