import type { CategorySummary } from "@bookkeeping/domain/categories";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { TransactionTag } from "@bookkeeping/domain/tags";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import type { components } from "@/core/api/openapi.gen";

/** A wallet an entry may pick. */
export interface WalletOption {
  id: string;
  name: string;
  type: components["schemas"]["Wallet"]["type"];
  openingDate: CalendarDate;
  archived?: boolean;
  /** Pre-formatted on the route; bigint does not cross the API. */
  balanceLabel: string;
}

export type CategoryOption = CategorySummary;

/**
 * The expense a refund is linked to, as the form shows it. The allowance is
 * parsed once from the API; bigint does not cross the API.
 */
export interface LinkedExpenseView {
  id: string;
  /** "฿500.00" */
  amountLabel: string;
  transactionDate: CalendarDate;
  /** The expense's category, for its hue; null when Uncategorized. */
  categoryId: string | null;
  categoryLabel: string;
  categoryIconId: string;
  /** The expense's tags, which a refund reports as its own. */
  tags: readonly TransactionTag[];
  wallet: { id: string; name: string; archived: boolean };
  /** What is left to refund, in satang, excluding the refund being edited. */
  refundAllowance: bigint;
}

/** A saved transaction as the edit form loads it. */
export interface EditableTransaction {
  id: string;
  type: TransactionType;
  walletId: string;
  categoryId: string;
  destinationWalletId: string;
  /** The stored amount in baht text, e.g. "120.00", exactly as saved. */
  amountText: string;
  transactionDate: CalendarDate;
  note: string;
  /** Its tags as read; a refund's are its expense's and are never sent back. */
  tagIds: string[];
  /** "13 Sep 2026, 14:32", already in Bangkok time. */
  recordedLabel: string;
  /** Set when the transaction is a refund. */
  refundOf?: LinkedExpenseView;
  /** For an expense: what its linked refunds add up to, if any. */
  refundedLabel?: string;
}
