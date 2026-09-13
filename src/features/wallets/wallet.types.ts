import type { CalendarDate } from "@/shared/helpers/dates";

// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const WALLET_TYPES = ["cash", "bank_account", "e_wallet"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: "Cash",
  bank_account: "Bank account",
  e_wallet: "E-wallet",
};

export interface WalletSummary {
  id: string;
  name: string;
  type: WalletType;
  currency: "THB";
  openingAmount: bigint;
  openingDate: CalendarDate;
  /** Derived: opening balance plus current transactions through `asOf`. */
  balance: bigint;
}
