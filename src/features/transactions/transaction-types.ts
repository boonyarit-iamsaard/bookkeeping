import type { TransactionType } from "@/core/database/schema/transaction-type";

export type { TransactionType } from "@/core/database/schema/transaction-type";
export { TRANSACTION_TYPES } from "@/core/database/schema/transaction-type";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
};

/** The sign that carries the type in figures; colour only ever reinforces it. */
export const TRANSACTION_TYPE_SIGNS: Record<TransactionType, string> = {
  income: "+",
  expense: "−",
};

/** "Food & Drink › Groceries" for a child, the bare name for a parent. */
export function categoryLabel(category: {
  name: string;
  parentName: string | null;
}): string {
  return category.parentName
    ? `${category.parentName} › ${category.name}`
    : category.name;
}
