import type { WalletType } from "@/features/wallets/wallet.types";
import type { CalendarDate } from "@/shared/helpers/dates";

// Plain value set, kept apart from the Drizzle table so client components can
// import it without pulling drizzle-orm into their bundle.
export const TRANSACTION_TYPES = ["income", "expense", "transfer"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

/** The sign that carries the type in figures; colour only ever reinforces it. */
export const TRANSACTION_TYPE_SIGNS: Record<TransactionType, string> = {
  income: "+",
  expense: "−",
  transfer: "",
};

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
  category: {
    id: string;
    name: string;
    iconId: string;
    parentName: string | null;
  } | null;
}

export const TRANSACTION_CHANGE_ACTIONS = ["edit", "delete"] as const;
export type TransactionChangeAction =
  (typeof TRANSACTION_CHANGE_ACTIONS)[number];

/**
 * The fields of a transaction that carry financial or descriptive meaning,
 * frozen as they stood before and after a change. Amounts are decimal
 * strings because JSON has no bigint. Transfer and refund corrections can
 * extend this shape without a new table.
 */
export interface TransactionSnapshot {
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
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
