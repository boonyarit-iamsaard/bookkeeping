import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { TransactionTag } from "@bookkeeping/domain/tags";
import type { TransactionType } from "@bookkeeping/domain/transactions";

/**
 * The expense a refund is linked to, as the form shows it. Figures arrive
 * pre-formatted; bigint does not cross into the client.
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
  /** What is left to refund, excluding the refund being edited: "300.00". */
  refundAllowanceText: string;
  /** The same figure for reading: "฿300.00". */
  refundAllowanceLabel: string;
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
  /** The tags it carries itself; a refund's are its expense's and stay empty here. */
  tagIds: string[];
  /** "13 Sep 2026, 14:32", already in Bangkok time. */
  recordedLabel: string;
  /** Set when the transaction is a refund. */
  refundOf?: LinkedExpenseView;
  /** For an expense: what its linked refunds add up to, if any. */
  refundedLabel?: string;
}
