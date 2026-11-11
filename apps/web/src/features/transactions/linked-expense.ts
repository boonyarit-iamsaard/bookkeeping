import { formatMoney } from "@bookkeeping/domain/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import type { LinkedExpenseView } from "@/features/transactions/transaction.types";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface LinkedExpenseViewOptions {
  expense: ApiTransaction;
  /** Read without the refund being edited, so the allowance is what it may take. */
  refunds: ApiTransactionRefunds;
}

/** Reads an API expense and its server-provided allowance for the refund form. */
export function linkedExpenseView({
  expense,
  refunds,
}: Readonly<LinkedExpenseViewOptions>): LinkedExpenseView {
  return {
    id: expense.id,
    amountLabel: formatMoney({
      amountInMinorUnits: parseApiMoney(expense.amount),
      currency: expense.amount.currency,
    }),
    transactionDate: expense.transactionDate,
    categoryId: expense.category?.id ?? null,
    categoryLabel: expense.category
      ? categoryLabel(expense.category)
      : "Uncategorized",
    categoryIconId: expense.category?.iconId ?? "",
    tags: expense.tags,
    wallet: {
      id: expense.wallet.id,
      name: expense.wallet.name,
      archived: expense.wallet.archived,
    },
    refundAllowance: parseApiMoney(refunds.refundAllowance),
  };
}

/** A UI hint mirroring the server's `exceeds-refundable` rule. */
export function canRecordRefund(
  refunds: Readonly<Pick<ApiTransactionRefunds, "refundAllowance">>,
): boolean {
  return parseApiMoney(refunds.refundAllowance) > 0n;
}

/** The allowance for reading: "฿300.00". */
export function refundAllowanceLabel(
  expense: Readonly<Pick<LinkedExpenseView, "refundAllowance">>,
): string {
  return formatMoney({
    amountInMinorUnits: expense.refundAllowance,
    currency: "THB",
  });
}
