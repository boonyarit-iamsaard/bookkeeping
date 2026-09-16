import type { CalendarDate } from "../dates/dates";
import type { Currency } from "../money/money";

// Plain value set; the Drizzle table derives its enum from it, never the reverse.
export const WALLET_TYPES = ["cash", "bank_account", "e_wallet"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export interface WalletSummary {
  id: string;
  name: string;
  type: WalletType;
  currency: Currency;
  openingAmount: bigint;
  openingDate: CalendarDate;
  archivedAt: Date | null;
  /** Derived: opening balance plus current transactions through `asOf`. */
  balance: bigint;
}

export interface WalletSnapshot {
  openingAmount: string;
  openingDate: string;
  archivedAt: string | null;
}
