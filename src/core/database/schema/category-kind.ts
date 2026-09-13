// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const CATEGORY_KINDS = ["income", "expense"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
