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
  TransactionListOrder,
  TransactionListSort,
} from "@bookkeeping/domain/transactions";
import { and, asc, count, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { isUuid } from "../shared/identifier";
import { carriesAnyTag } from "../tags/tag-links";
import type { TransactionRef } from "./transaction-detail";
import {
  currentRefundsOf,
  detailQuery,
  ownedCurrent,
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

const transactionListOrder = [
  desc(transactions.transactionDate),
  desc(transactions.recordedAt),
  desc(transactions.id),
] as const;

function transactionWhere(filters: Readonly<ListTransactionsOptions>) {
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
  );
}

/** Current financial history, newest transaction date first. */
export async function listTransactions(
  db: Database,
  filters: Readonly<ListTransactionsOptions>,
): Promise<readonly TransactionDetail[]> {
  const rows = await detailQuery(db)
    .where(transactionWhere(filters))
    .orderBy(...transactionListOrder);
  return toDetails(db, rows);
}

export interface ListNumberedTransactionPageOptions
  extends ListTransactionsOptions {
  /** From 1; a page past the last is empty. */
  page: number;
  pageSize: number;
  sort: TransactionListSort;
  order: TransactionListOrder;
}

export interface NumberedTransactionPage {
  items: readonly TransactionDetail[];
  /** Every transaction the filters match, across all pages. */
  total: number;
}

/**
 * One numbered page of current financial history in the chosen order. Ties
 * break by recording time, then id, in the same direction, so pages hold a
 * stable order. Amounts are stored unsigned, so amount sorts by size.
 */
export async function listNumberedTransactionPage(
  db: Database,
  options: Readonly<ListNumberedTransactionPageOptions>,
): Promise<NumberedTransactionPage> {
  const where = transactionWhere(options);
  const direction = options.order === "asc" ? asc : desc;
  const sortColumn =
    options.sort === "amount"
      ? transactions.amount
      : transactions.transactionDate;
  const [rows, [counted]] = await Promise.all([
    detailQuery(db)
      .where(where)
      .orderBy(
        direction(sortColumn),
        direction(transactions.recordedAt),
        direction(transactions.id),
      )
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db
      .select({ total: count() })
      .from(detailQuery(db).where(where).as("listed")),
  ]);
  return { items: await toDetails(db, rows), total: counted?.total ?? 0 };
}
