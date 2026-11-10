/*
 * Loads and locks the owner's records a transaction write names, then judges
 * it with `acceptTransaction`. Every lock is taken here, in one fixed order
 * that is the global lock order for transactions, categories, wallets, and
 * tags; any other operation that locks these rows takes them in the same
 * order, so no two writes can wait on each other in a cycle:
 *
 * 1. the record under correction or deletion (`FOR UPDATE`);
 * 2. the expense a refund names (`FOR UPDATE`);
 * 3. the named wallets (`FOR SHARE`, in id order);
 * 4. the named category (`FOR SHARE`);
 * 5. the named tags (`FOR SHARE`, in id order).
 */

import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { normalizeTagIds } from "@bookkeeping/domain/tags";
import type { RefundSummary } from "@bookkeeping/domain/transactions";
import { and, asc, eq, inArray } from "drizzle-orm";
import { isUuid } from "../shared/identifier";
import type { NotFound } from "../shared/not-found";
import { notFound } from "../shared/not-found";
import { lockOwnedTagIds, readTagIdsOf } from "../tags/tag-links";
import { currentRefundsOf, ownedCurrent } from "./transaction-detail";
import type {
  CategoryFact,
  CurrentTransactionFact,
  ExpenseFact,
  SnapshotSource,
  TransactionCommand,
  TransactionRejection,
  WalletFact,
} from "./transaction-rules";
import {
  acceptTransaction,
  refundsBlockingDeletion,
  walletIdsOf,
} from "./transaction-rules";

interface Owned {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
}

interface RecordRef extends Owned {
  id: string;
}

export interface OwnedCommand extends Owned {
  command: Readonly<TransactionCommand>;
}

/** A locked current record with every field its snapshot freezes. */
export interface LockedTransaction extends SnapshotSource {
  id: string;
  destinationWalletId: string | null;
  refundOfTransactionId: string | null;
}

interface LockedRow extends Omit<LockedTransaction, "tagIds"> {
  deletedAt: Date | null;
}

/** Judges a new transaction against the owner's records, locked in the global order. */
export function judgeNewTransaction(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<Result<TransactionCommand, TransactionRejection>> {
  return judgeAgainstLockedFacts(tx, { ownerId, command, current: null });
}

/** What a correction may change; the type and refund link stay the record's. */
export interface TransactionCorrection {
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  /** Integer satang, always positive; the stored type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
  /** Every tag the transaction carries afterwards; an empty list removes them all. */
  tagIds: readonly string[];
}

export interface CorrectionInput extends RecordRef {
  correction: Readonly<TransactionCorrection>;
}

export interface JudgedCorrection {
  /** The record as it stands, for the before snapshot. */
  current: LockedTransaction;
  /** The accepted correction, for the after snapshot. */
  command: TransactionCommand;
}

/**
 * Locks the owner's current record and judges a correction of it. A missing,
 * deleted, foreign, or malformed id reads as not found. The record may keep
 * the archived wallets it already has, and its refunds still bind it.
 */
export async function judgeCorrection(
  tx: Database,
  { ownerId, id, correction }: Readonly<CorrectionInput>,
): Promise<Result<JudgedCorrection, NotFound | TransactionRejection>> {
  const current = await lockRecord(tx, { ownerId, id });
  if (!current || current.deletedAt) {
    return err(notFound());
  }
  const command: TransactionCommand = {
    type: current.type,
    walletId: correction.walletId,
    categoryId: correction.categoryId,
    destinationWalletId: correction.destinationWalletId ?? null,
    // The link is fixed with the type; a correction cannot repoint a refund.
    refundOfTransactionId: current.refundOfTransactionId,
    amount: correction.amount,
    transactionDate: correction.transactionDate,
    note: correction.note,
    tagIds: normalizeTagIds(correction.tagIds),
  };
  const accepted = await judgeAgainstLockedFacts(tx, {
    ownerId,
    command,
    current: {
      id: current.id,
      walletIds: walletIdsOf(current),
      refunds: await currentRefundsOf(tx, current.id),
    },
  });
  if (!accepted.ok) {
    return err(accepted.error);
  }
  return ok({
    current: await withTags(tx, current),
    command: accepted.value,
  });
}

export type DeletionLock =
  /** Also covers another owner's record and a malformed identifier. */
  | { kind: "not-found" }
  | { kind: "already-deleted" }
  | {
      kind: "current";
      current: LockedTransaction;
      /** The refunds that keep the row; empty when it may be deleted. */
      blockingRefunds: readonly RefundSummary[];
    };

/** Locks the owner's record for deletion and says what, if anything, keeps it. */
export async function lockForDeletion(
  tx: Database,
  ref: Readonly<RecordRef>,
): Promise<DeletionLock> {
  const current = await lockRecord(tx, ref);
  if (!current) {
    return { kind: "not-found" };
  }
  if (current.deletedAt) {
    return { kind: "already-deleted" };
  }
  return {
    kind: "current",
    current: await withTags(tx, current),
    blockingRefunds: refundsBlockingDeletion(
      current,
      await currentRefundsOf(tx, current.id),
    ),
  };
}

interface JudgementInput extends OwnedCommand {
  /** The record under correction, or null for a new one. */
  current: CurrentTransactionFact | null;
}

/** Steps 2 to 5 of the global order, then the pure judgement. */
async function judgeAgainstLockedFacts(
  tx: Database,
  { ownerId, command, current }: Readonly<JudgementInput>,
): Promise<Result<TransactionCommand, TransactionRejection>> {
  const expense = await lockRefundedExpense(tx, { ownerId, command });
  const owned = await lockOwnedWallets(tx, { ownerId, command });
  const category = await lockOwnedCategory(tx, { ownerId, command });
  return acceptTransaction(command, {
    today: todayIn({ timeZone: APP_TIME_ZONE }),
    wallets: owned,
    tagIds: await lockOwnedTagIds(tx, { ownerId, tagIds: command.tagIds }),
    category,
    expense,
    current,
  });
}

/**
 * Step 1. The lock is owner-only, not limited to current records, so a
 * repeated deletion finds its deleted row and succeeds again.
 */
async function lockRecord(
  tx: Database,
  { ownerId, id }: Readonly<RecordRef>,
): Promise<LockedRow | undefined> {
  if (!isUuid(id)) {
    return undefined;
  }
  const [row] = await tx
    .select({
      id: transactions.id,
      type: transactions.type,
      walletId: transactions.walletId,
      categoryId: transactions.categoryId,
      destinationWalletId: transactions.destinationWalletId,
      refundOfTransactionId: transactions.refundOfTransactionId,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      note: transactions.note,
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, ownerId)))
    .for("update");
  return row;
}

async function withTags(
  tx: Database,
  row: Readonly<LockedRow>,
): Promise<LockedTransaction> {
  return { ...row, tagIds: await readTagIdsOf(tx, row.id) };
}

/** Step 2: a refund's expense with its current refunds; null unless it is one of the owner's current expenses. */
async function lockRefundedExpense(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<ExpenseFact | null> {
  if (
    command.type !== "refund" ||
    !command.refundOfTransactionId ||
    !isUuid(command.refundOfTransactionId)
  ) {
    return null;
  }
  const [expense] = await tx
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, command.refundOfTransactionId),
        ownedCurrent(ownerId),
      ),
    )
    .for("update");
  if (expense?.type !== "expense") {
    return null;
  }
  return {
    id: expense.id,
    amount: expense.amount,
    transactionDate: expense.transactionDate,
    refunds: await currentRefundsOf(tx, expense.id),
  };
}

/** Step 3: the owner's wallets among those the command names. */
async function lockOwnedWallets(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<WalletFact[]> {
  const ids = walletIdsOf(command).filter(isUuid);
  if (ids.length === 0) {
    return [];
  }
  return tx
    .select({
      id: wallets.id,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
    })
    .from(wallets)
    .where(and(inArray(wallets.id, ids), eq(wallets.userId, ownerId)))
    .orderBy(asc(wallets.id))
    .for("share");
}

/** Step 4: the owner's category the command names. */
async function lockOwnedCategory(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<CategoryFact | null> {
  if (!command.categoryId || !isUuid(command.categoryId)) {
    return null;
  }
  const [category] = await tx
    .select({ id: categories.id, kind: categories.kind })
    .from(categories)
    .where(
      and(
        eq(categories.id, command.categoryId),
        eq(categories.userId, ownerId),
      ),
    )
    .for("share");
  return category ?? null;
}
