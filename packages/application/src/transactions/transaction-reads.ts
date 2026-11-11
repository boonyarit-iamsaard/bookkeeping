import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type {
  ExpenseRefunds,
  TransactionChange,
  TransactionDetail,
  TransactionFilters,
} from "@bookkeeping/domain/transactions";
import { and, asc, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import { isUuid } from "../shared/identifier";
import { carriesAnyTag } from "../tags/tag-links";
import type { DetailRow, TransactionRef } from "./transaction-detail";
import {
  currentRefundsOf,
  detailQuery,
  ownedCurrent,
  recordingPosition,
  toDetails,
  toOneDetail,
} from "./transaction-detail";
import {
  refundAllowanceOf,
  refundsCountingAgainst,
  sumOf,
} from "./transaction-rules";

export type { TransactionRef } from "./transaction-detail";

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
