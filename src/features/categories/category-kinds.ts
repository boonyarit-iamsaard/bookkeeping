import type { CategoryKind } from "@/core/database/schema/category-kind";

export type { CategoryKind } from "@/core/database/schema/category-kind";

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Expense",
};
