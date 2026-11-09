import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type {
  RefundSummary,
  TransactionDetail,
} from "@bookkeeping/domain/transactions";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { readTagsByTransaction } from "../tags/tag-links";

const destinationWallets = alias(wallets, "destination_wallets");

const parentCategories = alias(categories, "parent_categories");

const refundedExpenses = alias(transactions, "refunded_expenses");

/** A text key that preserves PostgreSQL's microsecond recording precision. */
export const recordingPosition = sql<string>`to_char(${transactions.recordedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** The owner's current transactions: their own and not deleted. */
export function ownedCurrent(ownerId: string) {
  return and(eq(transactions.userId, ownerId), isNull(transactions.deletedAt));
}

/** Every current or past transaction joined to what its detail names; callers add the filter. */
export function detailQuery(db: Database) {
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

export type DetailRow = Awaited<ReturnType<typeof detailQuery>>[number];

function toDetail(
  row: DetailRow,
  tagsByTransaction: ReadonlyMap<string, TransactionDetail["tags"]>,
): TransactionDetail {
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
    tags: tagsByTransaction.get(row.refundOfId ?? row.id) ?? [],
  };
}

/** The rows as details, with the tags each carries; a refund reads its expense's. */
export async function toDetails(
  db: Database,
  rows: readonly DetailRow[],
): Promise<TransactionDetail[]> {
  const tagsByTransaction = await readTagsByTransaction(
    db,
    rows.map((row) => row.refundOfId ?? row.id),
  );
  return rows.map((row) => toDetail(row, tagsByTransaction));
}

/** One row as its detail; the row was just read, so it always maps. */
export async function toOneDetail(
  db: Database,
  row: DetailRow,
): Promise<TransactionDetail> {
  const [detail] = await toDetails(db, [row]);
  if (!detail) {
    throw new Error("Transaction detail could not be mapped");
  }
  return detail;
}

/** The nondeleted refunds linked to an expense, oldest date first. */
export async function currentRefundsOf(
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
