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
  /** Marks a Savings wallet. */
  savings: boolean;
  /** Derived: opening balance plus current transactions through `asOf`. */
  balance: bigint;
}

export interface WalletSnapshot {
  openingAmount: string;
  openingDate: string;
  archivedAt: string | null;
  /** Absent from history written before the marker existed. */
  savings?: boolean;
}

/**
 * The Total balance and its split into Spendable and Set aside, over the
 * Wallets opened by a date, archived ones included. Each figure is `null`
 * when no Wallet of its kind had opened; the counts cover opened Wallets.
 */
export interface WalletBalance {
  total: bigint | null;
  spendable: bigint | null;
  setAside: bigint | null;
  walletCount: number;
  spendableWalletCount: number;
  savingsWalletCount: number;
}
