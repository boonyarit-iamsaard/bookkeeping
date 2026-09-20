import type { CalendarDate } from "@bookkeeping/domain/dates";
import { parseCalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  LinkedExpense,
  RefundSummary,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@bookkeeping/domain/transactions";

/** The input a rejection addresses; an adapter maps it to its own pointer or form field. */
export type TransactionField =
  | "type"
  | "walletId"
  | "destinationWalletId"
  | "categoryId"
  | "refundOfTransactionId"
  | "amount"
  | "transactionDate"
  | "note";

/**
 * One expected reason a create or edit is refused, addressed to the input
 * that would correct it. The rule that refuses chooses the field, so every
 * adapter agrees on where a rejection belongs.
 */
export type TransactionRejection =
  | { field: "walletId"; code: "wallet-not-found" }
  | { field: "destinationWalletId"; code: "destination-wallet-not-found" }
  | { field: "destinationWalletId"; code: "same-wallet" }
  | {
      field: "walletId" | "destinationWalletId";
      code: "wallet-archived";
      walletId: string;
    }
  | { field: "type"; code: "invalid-transfer" }
  | { field: "categoryId"; code: "category-not-found" }
  | { field: "categoryId"; code: "category-kind-mismatch" }
  | { field: "amount"; code: "amount-out-of-range" }
  | { field: "note"; code: "note-too-long" }
  | { field: "transactionDate"; code: "invalid-date" }
  | { field: "transactionDate"; code: "future-date"; today: CalendarDate }
  | {
      field: "transactionDate";
      code: "before-opening";
      openingDate: CalendarDate;
    }
  | { field: "type"; code: "invalid-refund" }
  | { field: "refundOfTransactionId"; code: "expense-not-found" }
  | {
      field: "transactionDate";
      code: "before-expense";
      expenseDate: CalendarDate;
    }
  | { field: "amount"; code: "exceeds-refundable"; remaining: bigint }
  | { field: "amount"; code: "below-refunded"; refundedTotal: bigint }
  /** The earliest linked refund's date; the expense cannot move past it. */
  | {
      field: "transactionDate";
      code: "after-refund";
      refundDate: CalendarDate;
    };

/** Every financial field a create or edit is judged on. */
export interface TransactionCommand {
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId: string | null;
  refundOfTransactionId: string | null;
  /** Integer satang, always positive; the type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export interface WalletFact {
  id: string;
  openingDate: CalendarDate;
  archivedAt: Date | null;
}

export interface CategoryFact {
  id: string;
  kind: TransactionType;
}

/** The owner's current expense a refund names, with the refunds already counting against it. */
export interface ExpenseFact extends LinkedExpense {
  refunds: readonly RefundSummary[];
}

/** The record under correction: its wallets may be kept although archived, and its refunds bind it. */
export interface CurrentTransactionFact {
  id: string;
  walletIds: readonly string[];
  /** The current refunds linked to this record when it is an expense. */
  refunds: readonly RefundSummary[];
}

/**
 * Everything the owner's records say that the rules need, loaded and locked
 * by the operation before it asks. Absent facts read as not found: a wallet
 * missing from `wallets` is not the owner's, a null `category` or `expense`
 * was not found among the owner's current records.
 */
export interface TransactionFacts {
  today: CalendarDate;
  wallets: readonly WalletFact[];
  category: CategoryFact | null;
  expense: ExpenseFact | null;
  current: CurrentTransactionFact | null;
}

/**
 * Judges a create or edit against the owner's records and returns the
 * command unchanged when every rule holds. Rules run in a fixed order so a
 * command with several faults is always refused for the same one first:
 * bounds, then shape, then the records it names, then dates, then what its
 * refunds allow.
 */
export function acceptTransaction(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): Result<TransactionCommand, TransactionRejection> {
  const rejection =
    rejectValues(command) ??
    rejectTransferShape(command) ??
    rejectRefundShape(command) ??
    rejectMissingExpense(command, facts) ??
    rejectWallets(command, facts) ??
    rejectCategory(command, facts) ??
    rejectDate(command, facts) ??
    rejectRefundAgainstExpense(command, facts) ??
    rejectExpenseAgainstRefunds(command, facts);
  return rejection ? err(rejection) : ok({ ...command });
}

function rejectValues(
  command: Readonly<TransactionCommand>,
): TransactionRejection | undefined {
  if (
    command.amount < MIN_TRANSACTION_AMOUNT ||
    command.amount > MAX_TRANSACTION_AMOUNT
  ) {
    return { field: "amount", code: "amount-out-of-range" };
  }
  if (command.note.length > MAX_NOTE_LENGTH) {
    return { field: "note", code: "note-too-long" };
  }
  if (!parseCalendarDate(command.transactionDate).ok) {
    return { field: "transactionDate", code: "invalid-date" };
  }
  return undefined;
}

/** A transfer names two distinct wallets and no category. */
function rejectTransferShape(
  command: Readonly<TransactionCommand>,
): TransactionRejection | undefined {
  if (command.type !== "transfer") {
    return command.destinationWalletId
      ? { field: "type", code: "invalid-transfer" }
      : undefined;
  }
  if (!command.destinationWalletId || command.categoryId !== null) {
    return { field: "type", code: "invalid-transfer" };
  }
  if (command.walletId === command.destinationWalletId) {
    return { field: "destinationWalletId", code: "same-wallet" };
  }
  return undefined;
}

/** A refund names its expense and no category; nothing else names an expense. */
function rejectRefundShape(
  command: Readonly<TransactionCommand>,
): TransactionRejection | undefined {
  if (command.type !== "refund") {
    return command.refundOfTransactionId
      ? { field: "type", code: "invalid-refund" }
      : undefined;
  }
  if (!command.refundOfTransactionId || command.categoryId !== null) {
    return { field: "type", code: "invalid-refund" };
  }
  return undefined;
}

function rejectMissingExpense(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  if (command.type === "refund" && !facts.expense) {
    return { field: "refundOfTransactionId", code: "expense-not-found" };
  }
  return undefined;
}

export function walletIdsOf(
  command: Readonly<
    Pick<TransactionCommand, "walletId" | "destinationWalletId">
  >,
): string[] {
  return command.destinationWalletId
    ? [command.walletId, command.destinationWalletId]
    : [command.walletId];
}

function rejectWallets(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  const owned = new Map(facts.wallets.map((wallet) => [wallet.id, wallet]));
  if (!owned.has(command.walletId)) {
    return { field: "walletId", code: "wallet-not-found" };
  }
  if (command.destinationWalletId && !owned.has(command.destinationWalletId)) {
    return {
      field: "destinationWalletId",
      code: "destination-wallet-not-found",
    };
  }
  const retained = facts.current?.walletIds ?? [];
  for (const id of walletIdsOf(command)) {
    if (owned.get(id)?.archivedAt && !retained.includes(id)) {
      return {
        field:
          id === command.destinationWalletId
            ? "destinationWalletId"
            : "walletId",
        code: "wallet-archived",
        walletId: id,
      };
    }
  }
  return undefined;
}

function rejectCategory(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  if (command.type === "transfer" || command.type === "refund") {
    return undefined;
  }
  if (!command.categoryId || facts.category?.id !== command.categoryId) {
    return { field: "categoryId", code: "category-not-found" };
  }
  if (facts.category.kind !== command.type) {
    return { field: "categoryId", code: "category-kind-mismatch" };
  }
  return undefined;
}

function rejectDate(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  if (command.transactionDate > facts.today) {
    return {
      field: "transactionDate",
      code: "future-date",
      today: facts.today,
    };
  }
  const named = new Set(walletIdsOf(command));
  const unopened = facts.wallets.find(
    (wallet) =>
      named.has(wallet.id) && command.transactionDate < wallet.openingDate,
  );
  if (unopened) {
    return {
      field: "transactionDate",
      code: "before-opening",
      openingDate: unopened.openingDate,
    };
  }
  return undefined;
}

/** A refund under correction does not count its own old amount against the allowance. */
function rejectRefundAgainstExpense(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  if (command.type !== "refund" || !facts.expense) {
    return undefined;
  }
  if (command.transactionDate < facts.expense.transactionDate) {
    return {
      field: "transactionDate",
      code: "before-expense",
      expenseDate: facts.expense.transactionDate,
    };
  }
  const others = facts.expense.refunds.filter(
    (refund) => refund.id !== facts.current?.id,
  );
  const remaining = facts.expense.amount - sumOf(others);
  if (command.amount > remaining) {
    return { field: "amount", code: "exceeds-refundable", remaining };
  }
  return undefined;
}

/** An expense cannot contradict the refunds already linked to it. */
function rejectExpenseAgainstRefunds(
  command: Readonly<TransactionCommand>,
  facts: Readonly<TransactionFacts>,
): TransactionRejection | undefined {
  const refunds = facts.current?.refunds ?? [];
  if (command.type !== "expense" || refunds.length === 0) {
    return undefined;
  }
  const refundedTotal = sumOf(refunds);
  if (command.amount < refundedTotal) {
    return { field: "amount", code: "below-refunded", refundedTotal };
  }
  const earliest = refunds.reduce((first, refund) =>
    refund.transactionDate < first.transactionDate ? refund : first,
  );
  if (command.transactionDate > earliest.transactionDate) {
    return {
      field: "transactionDate",
      code: "after-refund",
      refundDate: earliest.transactionDate,
    };
  }
  return undefined;
}

export function sumOf(refunds: readonly RefundSummary[]): bigint {
  return refunds.reduce((total, refund) => total + refund.amount, 0n);
}

/** What a snapshot is taken from: a command, or a stored row with the same fields. */
export type SnapshotSource = Omit<
  TransactionCommand,
  "destinationWalletId" | "refundOfTransactionId"
> & {
  destinationWalletId?: string | null;
  refundOfTransactionId?: string | null;
};

/** Freezes the financial fields, keeping only the link that matches the type. */
export function snapshotOf(row: Readonly<SnapshotSource>): TransactionSnapshot {
  return {
    type: row.type,
    walletId: row.walletId,
    categoryId: row.categoryId,
    ...(row.type === "transfer"
      ? { destinationWalletId: row.destinationWalletId ?? null }
      : {}),
    ...(row.type === "refund"
      ? { refundOfTransactionId: row.refundOfTransactionId ?? null }
      : {}),
    amount: row.amount.toString(),
    transactionDate: row.transactionDate,
    note: row.note,
  };
}

const SNAPSHOT_KEYS = [
  "type",
  "walletId",
  "categoryId",
  "destinationWalletId",
  "refundOfTransactionId",
  "amount",
  "transactionDate",
  "note",
] as const satisfies readonly (keyof TransactionSnapshot)[];

export function sameSnapshot(
  a: Readonly<TransactionSnapshot>,
  b: Readonly<TransactionSnapshot>,
): boolean {
  return SNAPSHOT_KEYS.every((key) => a[key] === b[key]);
}
