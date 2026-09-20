import type { TransactionType } from "@bookkeeping/domain/transactions";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  refund: "Refund",
};

/** The sign that carries the type in figures; colour only ever reinforces it. */
export const TRANSACTION_TYPE_SIGNS: Record<TransactionType, string> = {
  income: "+",
  expense: "−",
  transfer: "",
  refund: "+",
};
