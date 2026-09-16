import type { CalendarDate } from "../dates/dates";
import type { WalletType } from "../wallets/wallet.types";

// Plain value set, kept apart from the Drizzle table so client code can
// import it without pulling drizzle-orm into its bundle.
export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
  "refund",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** The types the general creation picker offers; a refund starts from its expense. */
export const CREATABLE_TRANSACTION_TYPES = [
  "income",
  "expense",
  "transfer",
] as const;

export interface TransactionWalletReference {
  id: string;
  name: string;
  type: WalletType;
  archived: boolean;
}

export interface TransactionDetail {
  id: string;
  type: TransactionType;
  currency: "THB";
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
  /** The server instant of the original entry. */
  recordedAt: Date;
  wallet: TransactionWalletReference;
  destinationWallet: TransactionWalletReference | null;
  /** A refund's category is always its expense's current category. */
  category: {
    id: string;
    name: string;
    iconId: string;
    parentName: string | null;
  } | null;
  /** The expense a refund returns money for; null for every other type. */
  refundOf: LinkedExpense | null;
}

export interface LinkedExpense {
  id: string;
  amount: bigint;
  transactionDate: CalendarDate;
}

/** A refund as it counts against its expense's refundable amount. */
export interface RefundSummary {
  id: string;
  amount: bigint;
  transactionDate: CalendarDate;
  wallet: TransactionWalletReference;
}

export interface ExpenseRefunds {
  refunds: readonly RefundSummary[];
  /** Nondeleted refunds combined. */
  refundedTotal: bigint;
  /** The expense amount less the refunded total; never negative. */
  remaining: bigint;
}

export const TRANSACTION_CHANGE_ACTIONS = ["edit", "delete"] as const;
export type TransactionChangeAction =
  (typeof TRANSACTION_CHANGE_ACTIONS)[number];

/**
 * The fields of a transaction that carry financial or descriptive meaning,
 * frozen as they stood before and after a change. Amounts are decimal
 * strings because JSON has no bigint. Transfers add their destination and
 * refunds their expense; the link never changes, so it is kept for the record.
 */
export interface TransactionSnapshot {
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  refundOfTransactionId?: string | null;
  amount: string;
  transactionDate: string;
  note: string;
}

export interface TransactionChange {
  action: TransactionChangeAction;
  before: TransactionSnapshot;
  after: TransactionSnapshot | null;
  changedAt: Date;
}

export interface TransactionFilters {
  from?: CalendarDate;
  to?: CalendarDate;
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
}

export interface MonthlySummary {
  month: string;
  income: bigint;
  grossExpenses: bigint;
  refunds: bigint;
  netExpenses: bigint;
  net: bigint;
  transactionCount: number;
}
