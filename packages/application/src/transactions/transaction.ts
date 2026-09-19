import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type {
  ExpenseRefunds,
  RefundSummary,
  TransactionDetail,
  TransactionFilters,
} from "@bookkeeping/domain/transactions";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isUuid } from "../shared/identifier";

export interface TransactionRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

const destinationWallets = alias(wallets, "destination_wallets");

const parentCategories = alias(categories, "parent_categories");

const refundedExpenses = alias(transactions, "refunded_expenses");

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

/**
 * The record an idempotent create retry reads back through its receipt, even
 * if it was since deleted: a late retry must confirm the original outcome,
 * never recreate the record. Not for normal views, which must not see
 * deleted records; absorbed by the create operation with its own ticket.
 */
export async function findReplayedTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<TransactionDetail | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [row] = await detailQuery(db).where(
    and(eq(transactions.id, id), eq(transactions.userId, ownerId)),
  );
  return row ? toDetail(row) : null;
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

function sumOf(refunds: readonly RefundSummary[]): bigint {
  return refunds.reduce((total, refund) => total + refund.amount, 0n);
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

export interface ListTransactionsOptions extends TransactionFilters {
  /** Derived from the authenticated session at the edge. */
  ownerId: string;
}

/** Current financial history, newest transaction date first. */
export async function listTransactions(
  db: Database,
  filters: Readonly<ListTransactionsOptions>,
): Promise<readonly TransactionDetail[]> {
  const rows = await detailQuery(db)
    .where(
      and(
        eq(transactions.userId, filters.ownerId),
        isNull(transactions.deletedAt),
        filters.from
          ? gte(transactions.transactionDate, filters.from)
          : undefined,
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
      ),
    )
    .orderBy(
      desc(transactions.transactionDate),
      desc(transactions.recordedAt),
      desc(transactions.id),
    );
  return rows.map(toDetail);
}
