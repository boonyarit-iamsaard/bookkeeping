import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { normalizeTagIds } from "@bookkeeping/domain/tags";
import type {
  RefundSummary,
  TransactionChangeAction,
  TransactionDetail,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import { and, eq } from "drizzle-orm";
import type { IdempotentCreator } from "../idempotency/idempotency";
import { defineIdempotentCreation } from "../idempotency/idempotency";
import type { NotFound } from "../shared/not-found";
import { isNotFound, notFound } from "../shared/not-found";
import type { Rejected } from "../shared/rejection";
import { rejected } from "../shared/rejection";
import { replaceTagsOf } from "../tags/tag-links";
import type { TransactionRef } from "./transaction-detail";
import { detailQuery, toOneDetail } from "./transaction-detail";
import type {
  OwnedCommand,
  TransactionCorrection,
} from "./transaction-judgement";
import {
  judgeCorrection,
  judgeNewTransaction,
  lockForDeletion,
} from "./transaction-judgement";
import type {
  TransactionCommand,
  TransactionRejection,
} from "./transaction-rules";
import { sameSnapshot, snapshotOf } from "./transaction-rules";

export type { TransactionRef } from "./transaction-detail";
export type {
  TransactionField,
  TransactionRejection,
} from "./transaction-rules";

export interface CreateTransactionInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  /** The owner's expense a refund returns money for; refunds only. */
  refundOfTransactionId?: string | null;
  /** Integer satang, always positive; the type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
  /** The owner's tags to carry; income and expense only. */
  tagIds?: readonly string[];
}

/** The refused inputs of a transaction command, in the shared envelope. */
export type TransactionRejected = Rejected<TransactionRejection>;

/**
 * Creates one transaction and its durable result snapshot per idempotency key.
 * Every rule is judged inside the same transaction as the financial insert,
 * with the records it names locked; a refused command never consumes the key.
 */
export const createTransaction: IdempotentCreator<
  CreateTransactionInput,
  TransactionDetail,
  TransactionRejected
> = defineIdempotentCreation({
  operation: "transactions.create",
  prepare: (input: Readonly<CreateTransactionInput>) =>
    ok(toTransactionCommand(input)),
  insert: insertTransaction,
});

function toTransactionCommand(
  input: Readonly<
    Pick<
      CreateTransactionInput,
      | "type"
      | "walletId"
      | "categoryId"
      | "destinationWalletId"
      | "refundOfTransactionId"
      | "amount"
      | "transactionDate"
      | "note"
      | "tagIds"
    >
  >,
): TransactionCommand {
  return {
    type: input.type,
    walletId: input.walletId,
    categoryId: input.categoryId,
    destinationWalletId: input.destinationWalletId ?? null,
    refundOfTransactionId: input.refundOfTransactionId ?? null,
    amount: input.amount,
    transactionDate: input.transactionDate,
    note: input.note,
    tagIds: normalizeTagIds(input.tagIds ?? []),
  };
}

async function insertTransaction(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<Result<TransactionDetail, TransactionRejected>> {
  const accepted = await judgeNewTransaction(tx, { ownerId, command });
  if (!accepted.ok) {
    return err(rejected(accepted.error));
  }
  const [row] = await tx
    .insert(transactions)
    .values({
      userId: ownerId,
      type: command.type,
      walletId: command.walletId,
      categoryId: command.categoryId,
      destinationWalletId: command.destinationWalletId,
      refundOfTransactionId: command.refundOfTransactionId,
      currency: "THB",
      amount: command.amount,
      transactionDate: command.transactionDate,
      note: command.note,
    })
    .returning({ id: transactions.id });
  if (!row) {
    throw new Error("Transaction insert returned no row");
  }
  await replaceTagsOf(tx, { transactionId: row.id, tagIds: command.tagIds });
  const [detailRow] = await detailQuery(tx).where(
    and(eq(transactions.id, row.id), eq(transactions.userId, ownerId)),
  );
  if (!detailRow) {
    throw new Error("Created transaction could not be read back");
  }
  return ok(await toOneDetail(tx, detailRow));
}

export interface UpdateTransactionInput
  extends TransactionRef,
    TransactionCorrection {}

export type UpdateTransactionError = NotFound | TransactionRejected;

/**
 * Corrects a transaction in place. The type and its refund link are fixed;
 * the wallet, category, amount, date, and note are judged again against the
 * owner's records inside the committing transaction, and an edit may keep
 * the archived wallets it already has. The recording time is kept and the
 * before/after snapshots are written with the change, so history and
 * balances can never disagree. An edit that changes nothing succeeds and
 * leaves no history.
 */
export async function updateTransaction(
  db: Database,
  { ownerId, id, ...correction }: Readonly<UpdateTransactionInput>,
): Promise<Result<TransactionDetail, UpdateTransactionError>> {
  return db.transaction(async (tx) => {
    const judged = await judgeCorrection(tx, { ownerId, id, correction });
    if (!judged.ok) {
      return err(
        isNotFound(judged.error) ? judged.error : rejected(judged.error),
      );
    }
    const { current, command } = judged.value;
    const before = snapshotOf(current);
    const after = snapshotOf(command);
    if (!sameSnapshot(before, after)) {
      await tx
        .update(transactions)
        .set({
          walletId: command.walletId,
          categoryId: command.categoryId,
          destinationWalletId: command.destinationWalletId,
          amount: command.amount,
          transactionDate: command.transactionDate,
          note: command.note,
        })
        .where(eq(transactions.id, current.id));
      await replaceTagsOf(tx, {
        transactionId: current.id,
        tagIds: command.tagIds,
      });
      await recordChange(tx, {
        ownerId,
        transactionId: current.id,
        action: "edit",
        before,
        after,
      });
    }
    const [detailRow] = await detailQuery(tx).where(
      and(eq(transactions.id, current.id), eq(transactions.userId, ownerId)),
    );
    if (!detailRow) {
      throw new Error("Edited transaction could not be read back");
    }
    return ok(await toOneDetail(tx, detailRow));
  });
}

/**
 * Soft-deletes a transaction: it leaves lists, detail, and every balance,
 * while the row and its receipts stay so a late create retry confirms the
 * original outcome instead of recreating it. The internal `delete` history
 * is written in the same transaction as the soft deletion. Repeating a
 * deletion is the same outcome, without new history. An expense keeps its
 * row while any of its refunds still count, and the blocking refunds are
 * returned so a client can remove them first.
 */
export type DeleteTransactionError =
  | NotFound
  /** An expense keeps its row while any of these refunds still count. */
  | { code: "refunds-exist"; refunds: readonly RefundSummary[] };

export async function deleteTransaction(
  db: Database,
  ref: Readonly<TransactionRef>,
): Promise<Result<{ id: string }, DeleteTransactionError>> {
  return db.transaction(async (tx) => {
    const locked = await lockForDeletion(tx, ref);
    if (locked.kind === "not-found") {
      return err(notFound());
    }
    if (locked.kind === "already-deleted") {
      return ok({ id: ref.id });
    }
    const { current, blockingRefunds } = locked;
    if (blockingRefunds.length > 0) {
      return err({ code: "refunds-exist", refunds: blockingRefunds });
    }
    await tx
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, current.id));
    await recordChange(tx, {
      ownerId: ref.ownerId,
      transactionId: current.id,
      action: "delete",
      before: snapshotOf(current),
      after: null,
    });
    return ok({ id: current.id });
  });
}

interface RecordChangeInput {
  ownerId: string;
  transactionId: string;
  action: TransactionChangeAction;
  before: TransactionSnapshot;
  after: TransactionSnapshot | null;
}

async function recordChange(tx: Database, input: Readonly<RecordChangeInput>) {
  await tx.insert(transactionChanges).values({
    userId: input.ownerId,
    transactionId: input.transactionId,
    action: input.action,
    before: input.before,
    after: input.after,
  });
}
