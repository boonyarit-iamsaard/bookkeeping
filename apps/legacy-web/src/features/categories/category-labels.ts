import type { CategoryKind } from "@bookkeeping/domain/categories";

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Expense",
};
