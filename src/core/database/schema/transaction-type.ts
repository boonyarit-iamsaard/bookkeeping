// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
