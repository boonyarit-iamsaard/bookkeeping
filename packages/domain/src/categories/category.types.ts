// Plain value set, kept apart from the Drizzle table so client code can
// import it without pulling drizzle-orm into its bundle.
export const CATEGORY_KINDS = ["income", "expense"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export interface CategorySummary {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  iconId: string;
  isProtected: boolean;
}

export const UNCATEGORIZED_NAME = "Uncategorized";
