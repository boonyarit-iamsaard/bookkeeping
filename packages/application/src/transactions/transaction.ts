import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  ExpenseRefunds,
  MonthlySummary,
  RefundSummary,
  TransactionChange,
  TransactionChangeAction,
  TransactionDetail,
  TransactionFilters,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  IdempotencyConflict,
  ValidatedPayload,
} from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import type {
  CategoryFact,
  CurrentTransactionFact,
  ExpenseFact,
  TransactionCommand,
  TransactionRejection,
  WalletFact,
} from "./transaction-rules";
import {
  acceptTransaction,
  sameSnapshot,
  snapshotOf,
  sumOf,
  walletIdsOf,
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

const destinationWallets = alias(wallets, "destination_wallets");

const parentCategories = alias(categories, "parent_categories");

const refundedExpenses = alias(transactions, "refunded_expenses");

/** A text key that preserves PostgreSQL's microsecond recording precision. */
const recordingPosition = sql<string>`to_char(${transactions.recordedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function detailQuery(db: Database) {
  return (
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        note: transactions.note,
        recordedAt: transactions.recordedAt,
        recordingPosition,
        walletId: wallets.id,
        walletName: wallets.name,
        walletType: wallets.type,
        walletArchivedAt: wallets.archivedAt,
        destinationWalletId: destinationWallets.id,
        destinationWalletName: destinationWallets.name,
        destinationWalletType: destinationWallets.type,
        destinationWalletArchivedAt: destinationWallets.archivedAt,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIconId: categories.iconId,
        parentName: parentCategories.name,
        refundOfId: refundedExpenses.id,
        refundOfAmount: refundedExpenses.amount,
        refundOfTransactionDate: refundedExpenses.transactionDate,
      })
      .from(transactions)
      .innerJoin(wallets, eq(wallets.id, transactions.walletId))
      .leftJoin(
        destinationWallets,
        eq(destinationWallets.id, transactions.destinationWalletId),
      )
      .leftJoin(
        refundedExpenses,
        eq(refundedExpenses.id, transactions.refundOfTransactionId),
      )
      // A refund carries no category of its own: it reads its expense's
      // current one, so category changes and removal fallbacks follow at once.
      .leftJoin(
        categories,
        eq(
          categories.id,
          sql`coalesce(${transactions.categoryId}, ${refundedExpenses.categoryId})`,
        ),
      )
      .leftJoin(parentCategories, eq(parentCategories.id, categories.parentId))
  );
}

type DetailRow = Awaited<ReturnType<typeof detailQuery>>[number];

function toDetail(row: DetailRow): TransactionDetail {
  return {
    id: row.id,
    type: row.type,
    currency: "THB",
    amount: row.amount,
    transactionDate: row.transactionDate,
    note: row.note,
    recordedAt: row.recordedAt,
    wallet: {
      id: row.walletId,
      name: row.walletName,
      type: row.walletType,
      archived: Boolean(row.walletArchivedAt),
    },
    destinationWallet:
      row.destinationWalletId &&
      row.destinationWalletName &&
      row.destinationWalletType
        ? {
            id: row.destinationWalletId,
            name: row.destinationWalletName,
            type: row.destinationWalletType,
            archived: Boolean(row.destinationWalletArchivedAt),
          }
        : null,
    category:
      row.categoryId && row.categoryName && row.categoryIconId
        ? {
            id: row.categoryId,
            name: row.categoryName,
            iconId: row.categoryIconId,
            parentName: row.parentName,
          }
        : null,
    refundOf:
      row.refundOfId && row.refundOfAmount && row.refundOfTransactionDate
        ? {
            id: row.refundOfId,
            amount: row.refundOfAmount,
            transactionDate: row.refundOfTransactionDate,
          }
        : null,
  };
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
    and(
      eq(transactions.id, id),
      eq(transactions.userId, ownerId),
      isNull(transactions.deletedAt),
    ),
  );
  return row ? toDetail(row) : null;
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
}

export interface CreateTransactionOutcome {
  transaction: TransactionDetail;
  /** True when an earlier request with the same key already created it. */
  replayed: boolean;
}

export type CreateTransactionError = TransactionRejection | IdempotencyConflict;

const TRANSACTION_CREATION_OPERATION = "transactions.create";

/**
 * Creates one transaction and its durable result snapshot per idempotency key.
 * Every rule is judged inside the same transaction as the financial insert,
 * with the records it names locked; a refused command never consumes the key.
 */
export async function createTransaction(
  db: Database,
  input: Readonly<CreateTransactionInput>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  const command = toTransactionCommand(input);
  const outcome = await executeIdempotentCreation<
    TransactionDetail,
    TransactionRejection
  >(db, {
    ownerId: input.ownerId,
    operation: TRANSACTION_CREATION_OPERATION,
    key: input.idempotencyKey,
    payload: transactionCreationPayload(command),
    create: (tx) => insertTransaction(tx, { ownerId: input.ownerId, command }),
  });
  if (!outcome.ok) {
    return err(outcome.error);
  }
  return ok({
    transaction: outcome.value.result,
    replayed: outcome.value.replayed,
  });
}

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
  };
}

function transactionCreationPayload(
  command: Readonly<TransactionCommand>,
): ValidatedPayload {
  return {
    type: command.type,
    walletId: command.walletId,
    categoryId: command.categoryId,
    destinationWalletId: command.destinationWalletId,
    refundOfTransactionId: command.refundOfTransactionId,
    amount: command.amount,
    transactionDate: command.transactionDate,
    note: command.note,
  };
}

async function insertTransaction(
  tx: Database,
  { ownerId, command }: Readonly<OwnedCommand>,
): Promise<Result<TransactionDetail, TransactionRejection>> {
  const accepted = await judgeTransaction(tx, {
    ownerId,
    command,
    current: null,
  });
  if (!accepted.ok) {
    return err(accepted.error);
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
  const [detailRow] = await detailQuery(tx).where(
    and(eq(transactions.id, row.id), eq(transactions.userId, ownerId)),
  );
  if (!detailRow) {
    throw new Error("Created transaction could not be read back");
  }
  return ok(toDetail(detailRow));
}

interface OwnedCommand {
  ownerId: string;
  command: Readonly<TransactionCommand>;
}

interface JudgementInput extends OwnedCommand {
  /** The record under correction, or null for a new one. */
  current: CurrentTransactionFact | null;
}

/**
 * Loads and locks the owner's records the command names, then judges it.
 * The expense lock comes before wallet locks everywhere, so refunds,
 * corrections, and wallet archiving cannot wait on each other in a cycle.
 */
async function judgeTransaction(
  tx: Database,
  { ownerId, command, current }: Readonly<JudgementInput>,
): Promise<Result<TransactionCommand, TransactionRejection>> {
  const expense = await lockRefundedExpense(tx, { ownerId, command });
  const owned = await lockOwnedWallets(tx, { ownerId, command });
  const category = await readOwnedCategory(tx, { ownerId, command });
  return acceptTransaction(command, {
    today: todayIn({ timeZone: APP_TIME_ZONE }),
    wallets: owned,
    category,
    expense,
    current,
  });
}

/** A refund's expense with its current refunds; null unless it is one of the owner's current expenses. */
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
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, command.refundOfTransactionId),
        eq(transactions.userId, ownerId),
      ),
    )
    .for("update");
  if (!expense || expense.deletedAt || expense.type !== "expense") {
    return null;
  }
  return {
    id: expense.id,
    amount: expense.amount,
    transactionDate: expense.transactionDate,
    refunds: await currentRefundsOf(tx, expense.id),
  };
}

/** The owner's wallets among those the command names, share-locked for the rest of the transaction. */
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

async function readOwnedCategory(
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

/** The nondeleted refunds linked to an expense, oldest date first. */
async function currentRefundsOf(
  db: Database,
  expenseId: string,
): Promise<readonly RefundSummary[]> {
  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      walletId: wallets.id,
      walletName: wallets.name,
      walletType: wallets.type,
      walletArchivedAt: wallets.archivedAt,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .where(
      and(
        eq(transactions.refundOfTransactionId, expenseId),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(
      asc(transactions.transactionDate),
      asc(transactions.recordedAt),
      asc(transactions.id),
    );
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    transactionDate: row.transactionDate,
    wallet: {
      id: row.walletId,
      name: row.walletName,
      type: row.walletType,
      archived: Boolean(row.walletArchivedAt),
    },
  }));
}

/**
 * The current refunds linked to one of the owner's expenses, oldest date
 * first, with what they add up to and what is left to refund. `null` unless
 * the id names one of the owner's current expenses: the allowance is not
 * defined for any other transaction.
 */
export async function findExpenseRefunds(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<ExpenseRefunds | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [expense] = await db
    .select({ amount: transactions.amount, type: transactions.type })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
      ),
    );
  if (expense?.type !== "expense") {
    return null;
  }
  const refunds = await currentRefundsOf(db, id);
  const refundedTotal = sumOf(refunds);
  const remaining = expense.amount - refundedTotal;
  return {
    refunds,
    refundedTotal,
    remaining: remaining > 0n ? remaining : 0n,
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
    .where(
      and(eq(transactions.userId, ownerId), isNull(transactions.deletedAt)),
    )
    .orderBy(desc(transactions.recordedAt), desc(transactions.id))
    .limit(1);
  return row?.walletId ?? null;
}

export interface UpdateTransactionInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  /** Integer satang, always positive; the stored type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export type UpdateTransactionError =
  /** Also covers another owner's record and a deleted one. */
  { code: "transaction-not-found" } | TransactionRejection;

/**
 * Locks the owner's current (undeleted) transaction for the rest of the
 * transaction, so concurrent edits and deletions apply one after another.
 */
async function lockCurrentTransaction(
  tx: Database,
  { ownerId, id }: Readonly<TransactionRef>,
) {
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
  input: Readonly<UpdateTransactionInput>,
): Promise<Result<TransactionDetail, UpdateTransactionError>> {
  let rejection: UpdateTransactionError | undefined;
  let updated: TransactionDetail | undefined;
  await db.transaction(async (tx) => {
    const current = await lockCurrentTransaction(tx, input);
    if (!current || current.deletedAt) {
      rejection = { code: "transaction-not-found" };
      return;
    }
    const command = toTransactionCommand({
      type: current.type,
      walletId: input.walletId,
      categoryId: input.categoryId,
      destinationWalletId: input.destinationWalletId,
      // The link is fixed with the type; the input cannot repoint a refund.
      refundOfTransactionId: current.refundOfTransactionId,
      amount: input.amount,
      transactionDate: input.transactionDate,
      note: input.note,
    });
    const accepted = await judgeTransaction(tx, {
      ownerId: input.ownerId,
      command,
      current: {
        id: current.id,
        walletIds: walletIdsOf(current),
        refunds:
          current.type === "expense"
            ? await currentRefundsOf(tx, current.id)
            : [],
      },
    });
    if (!accepted.ok) {
      rejection = accepted.error;
      return;
    }
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
      await recordChange(tx, {
        ownerId: input.ownerId,
        transactionId: current.id,
        action: "edit",
        before,
        after,
      });
    }
    const [detailRow] = await detailQuery(tx).where(
      and(
        eq(transactions.id, current.id),
        eq(transactions.userId, input.ownerId),
      ),
    );
    if (!detailRow) {
      throw new Error("Edited transaction could not be read back");
    }
    updated = toDetail(detailRow);
  });

  if (rejection) {
    return err(rejection);
  }
  if (!updated) {
    throw new Error("Edited transaction could not be read back");
  }
  return ok(updated);
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
  /** Also covers another owner's record and an unknown identifier. */
  | { code: "transaction-not-found" }
  /** An expense keeps its row while any of these refunds still count. */
  | { code: "refunds-exist"; refunds: readonly RefundSummary[] };

export async function deleteTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<Result<{ id: string }, DeleteTransactionError>> {
  let found = false;
  let blocking: readonly RefundSummary[] = [];
  await db.transaction(async (tx) => {
    const current = await lockCurrentTransaction(tx, { ownerId, id });
    if (!current) {
      return;
    }
    found = true;
    if (current.deletedAt) {
      return;
    }
    if (current.type === "expense") {
      blocking = await currentRefundsOf(tx, current.id);
      if (blocking.length > 0) {
        return;
      }
    }
    await tx
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, current.id));
    await recordChange(tx, {
      ownerId,
      transactionId: current.id,
      action: "delete",
      before: snapshotOf(current),
      after: null,
    });
  });
  if (!found) {
    return err({ code: "transaction-not-found" });
  }
  if (blocking.length > 0) {
    return err({ code: "refunds-exist", refunds: blocking });
  }
  return ok({ id });
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
    eq(transactions.userId, filters.ownerId),
    isNull(transactions.deletedAt),
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
  return rows.map(toDetail);
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
  const last = items[items.length - 1];
  return {
    items: items.map(toDetail),
    nextPosition:
      rows.length > options.limit && last
        ? toTransactionListPosition(last)
        : null,
  };
}

interface MonthlySummaryOptions {
  ownerId: string;
  /** Validated YYYY-MM at the authenticated edge. Financial dates are Bangkok calendar dates. */
  month: string;
}

/** PostgreSQL numeric SUM returns decimal strings, preserving exact large totals. */
export async function getMonthlySummary(
  db: Database,
  { ownerId, month }: Readonly<MonthlySummaryOptions>,
): Promise<MonthlySummary> {
  const start = `${month}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const end = monthEnd.toISOString().slice(0, 10);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      grossExpenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      refunds: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'refund'), 0)`,
      transactionCount: sql<string>`count(*) filter (where ${transactions.type} != 'transfer')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    );
  if (!row) {
    throw new Error("Monthly aggregate returned no row");
  }
  const income = BigInt(row.income);
  const grossExpenses = BigInt(row.grossExpenses);
  const refunds = BigInt(row.refunds);
  const netExpenses = grossExpenses - refunds;
  return {
    month,
    income,
    grossExpenses,
    refunds,
    netExpenses,
    net: income - netExpenses,
    transactionCount: Number(row.transactionCount),
  };
}
