import type { CalendarDate } from "@bookkeeping/domain/dates";

/**
 * The expense a refund is linked to, as the form shows it. Figures arrive
 * pre-formatted; bigint does not cross into the client.
 */
export interface LinkedExpenseView {
  id: string;
  /** "฿500.00" */
  amountLabel: string;
  transactionDate: CalendarDate;
  categoryLabel: string;
  categoryIconId: string;
  wallet: { id: string; name: string; archived: boolean };
  /** What is left to refund, excluding the refund being edited: "300.00". */
  remainingText: string;
  /** The same figure for reading: "฿300.00". */
  remainingLabel: string;
}
