// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const CATEGORY_KINDS = ["income", "expense"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Expense",
};

export interface CategorySummary {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  iconId: string;
  isProtected: boolean;
}

export const UNCATEGORIZED_NAME = "Uncategorized";
