import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { normalizeTagIds } from "@bookkeeping/domain/tags";
import type {
  ExpenseRefunds,
  RefundSummary,
  TransactionChange,
  TransactionChangeAction,
  TransactionDetail,
  TransactionFilters,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import { and, asc, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import type {} from "../idempotency/idempotency";
import { defineIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import type { NotFound } from "../shared/not-found";
import { isNotFound, notFound } from "../shared/not-found";
import type { Rejected } from "../shared/rejection";
import { rejected } from "../shared/rejection";
import { carriesAnyTag, replaceTagsOf } from "../tags/tag-links";
import type { DetailRow } from "./transaction-detail";
import {
  currentRefundsOf,
  detailQuery,
  ownedCurrent,
  recordingPosition,
  toDetails,
  toOneDetail,
} from "./transaction-detail";
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
import {
  refundAllowanceOf,
  refundsCountingAgainst,
  sameSnapshot,
  snapshotOf,
  sumOf,
} from "./transaction-rules";

export type {
  TransactionField,
  TransactionRejection,
} from "./transaction-rules";

export interface TransactionRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

/**
 * One owned current transaction with its wallet, destination, category, and
 * expense link, or `null` when the owner has none: a missing, deleted,
 * foreign, or malformed identifier all read as not found.
 */
export async function findTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<TransactionDetail | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [row] = await detailQuery(db).where(
    and(eq(transactions.id, id), ownedCurrent(ownerId)),
  );
  return row ? toOneDetail(db, row) : null;
}

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
export const createTransaction = defineIdempotentCreation({
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

export interface ExpenseRefundsQuery extends TransactionRef {
  /**
   * A refund under correction, left out so the allowance is what that refund
   * may take, as the correction rule counts it.
   */
  excluding?: string;
}

/**
 * The current refunds linked to one of the owner's expenses, oldest date
 * first, with what they add up to and what is left to refund. `null` unless
 * the id names one of the owner's current expenses: the allowance is not
 * defined for any other transaction.
 */
export async function findExpenseRefunds(
  db: Database,
  { ownerId, id, excluding }: Readonly<ExpenseRefundsQuery>,
): Promise<ExpenseRefunds | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [expense] = await db
    .select({ amount: transactions.amount, type: transactions.type })
    .from(transactions)
    .where(and(eq(transactions.id, id), ownedCurrent(ownerId)));
  if (expense?.type !== "expense") {
    return null;
  }
  const refunds = refundsCountingAgainst(
    await currentRefundsOf(db, id),
    excluding,
  );
  return {
    refunds,
    refundedTotal: sumOf(refunds),
    refundAllowance: refundAllowanceOf({
      expenseAmount: expense.amount,
      refunds,
    }),
  };
}

/** The wallet the owner recorded into most recently, if any. */
export async function findLastUsedWalletId(
  db: Database,
  ownerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ walletId: transactions.walletId })
    .from(transactions)
    .where(ownedCurrent(ownerId))
    .orderBy(desc(transactions.recordedAt), desc(transactions.id))
    .limit(1);
  return row?.walletId ?? null;
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

/** The internal change history of one transaction, oldest first. Not for normal views. */
export async function listTransactionChanges(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<readonly TransactionChange[]> {
  return db
    .select({
      action: transactionChanges.action,
      before: transactionChanges.before,
      after: transactionChanges.after,
      changedAt: transactionChanges.changedAt,
    })
    .from(transactionChanges)
    .where(
      and(
        eq(transactionChanges.transactionId, id),
        eq(transactionChanges.userId, ownerId),
      ),
    )
    .orderBy(asc(transactionChanges.changedAt), asc(transactionChanges.id));
}

export interface ListTransactionsOptions extends TransactionFilters {
  /** Derived from the authenticated session at the edge. */
  ownerId: string;
}

export interface TransactionListPosition {
  transactionDate: TransactionDetail["transactionDate"];
  /** Canonical UTC text with six fractional-second digits. */
  recordedAt: string;
  id: string;
}

export interface ListTransactionPageOptions extends ListTransactionsOptions {
  limit: number;
  after?: TransactionListPosition;
}

export interface TransactionPage {
  items: readonly TransactionDetail[];
  nextPosition: TransactionListPosition | null;
}

interface TransactionWhereOptions {
  filters: Readonly<ListTransactionsOptions>;
  after?: TransactionListPosition;
}

const transactionListOrder = [
  desc(transactions.transactionDate),
  desc(transactions.recordedAt),
  desc(transactions.id),
] as const;

function transactionWhere({
  filters,
  after,
}: Readonly<TransactionWhereOptions>) {
  const sameDate = after
    ? eq(transactions.transactionDate, after.transactionDate)
    : undefined;
  const sameRecordingTime = after
    ? eq(recordingPosition, after.recordedAt)
    : undefined;

  return and(
    ownedCurrent(filters.ownerId),
    filters.from ? gte(transactions.transactionDate, filters.from) : undefined,
    filters.to ? lte(transactions.transactionDate, filters.to) : undefined,
    filters.type ? eq(transactions.type, filters.type) : undefined,
    filters.walletId
      ? and(
          eq(wallets.userId, filters.ownerId),
          or(
            eq(transactions.walletId, filters.walletId),
            eq(transactions.destinationWalletId, filters.walletId),
          ),
        )
      : undefined,
    filters.categoryId
      ? and(
          eq(categories.userId, filters.ownerId),
          or(
            eq(categories.id, filters.categoryId),
            eq(categories.parentId, filters.categoryId),
          ),
        )
      : undefined,
    filters.tagIds?.length
      ? carriesAnyTag(
          sql`coalesce(${transactions.refundOfTransactionId}, ${transactions.id})`,
          filters.tagIds,
        )
      : undefined,
    after
      ? or(
          lt(transactions.transactionDate, after.transactionDate),
          and(sameDate, lt(recordingPosition, after.recordedAt)),
          and(sameDate, sameRecordingTime, lt(transactions.id, after.id)),
        )
      : undefined,
  );
}

function toTransactionListPosition(
  row: Readonly<
    Pick<DetailRow, "transactionDate" | "recordingPosition" | "id">
  >,
) {
  return {
    transactionDate: row.transactionDate,
    recordedAt: row.recordingPosition,
    id: row.id,
  };
}

/** Current financial history, newest transaction date first. */
export async function listTransactions(
  db: Database,
  filters: Readonly<ListTransactionsOptions>,
): Promise<readonly TransactionDetail[]> {
  const rows = await detailQuery(db)
    .where(transactionWhere({ filters }))
    .orderBy(...transactionListOrder);
  return toDetails(db, rows);
}

/** One keyset page of current financial history, newest first. */
export async function listTransactionPage(
  db: Database,
  options: Readonly<ListTransactionPageOptions>,
): Promise<TransactionPage> {
  const rows = await detailQuery(db)
    .where(transactionWhere({ filters: options, after: options.after }))
    .orderBy(...transactionListOrder)
    .limit(options.limit + 1);
  const items = rows.slice(0, options.limit);
  const last = items.at(-1);
  return {
    items: await toDetails(db, items),
    nextPosition:
      rows.length > options.limit && last
        ? toTransactionListPosition(last)
        : null,
  };
}
