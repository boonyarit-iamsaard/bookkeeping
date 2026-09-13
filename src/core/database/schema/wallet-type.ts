// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const WALLET_TYPES = ["cash", "bank_account", "e_wallet"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];
