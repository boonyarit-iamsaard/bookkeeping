import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import {
  APP_TIME_ZONE,
  addDays,
  earlierOf,
  todayIn,
} from "@bookkeeping/domain/dates";
import type {
  CategorySpending,
  ClosingBalanceEntry,
  ClosingBalances,
  DailySummary,
  MonthlySummary,
  ParentCategorySpending,
  RangeSummary,
} from "@bookkeeping/domain/transactions";
import { and, asc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { movesWallet, walletMovement } from "../wallets/wallet-balance";

interface MonthlySummaryOptions {
  ownerId: string;
  /** Validated YYYY-MM at the authenticated edge. Financial dates are Bangkok calendar dates. */
  month: string;
}

/** A YYYY-MM month's first and last calendar dates. */
function monthBounds(month: string) {
  const start = `${month}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  return { start, end: monthEnd.toISOString().slice(0, 10) };
}

interface RangeSummaryOptions {
  ownerId: string;
  /** Inclusive Bangkok calendar dates in YYYY-MM-DD form. */
  start: string;
  end: string;
}

/** PostgreSQL numeric SUM returns decimal strings, preserving exact large totals. */
async function getRangeSummary(
  db: Database,
  { ownerId, start, end }: Readonly<RangeSummaryOptions>,
): Promise<RangeSummary> {
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
    throw new Error("Summary aggregate returned no row");
  }
  const income = BigInt(row.income);
  const grossExpenses = BigInt(row.grossExpenses);
  const refunds = BigInt(row.refunds);
  const netExpenses = grossExpenses - refunds;
  return {
    income,
    grossExpenses,
    refunds,
    netExpenses,
    net: income - netExpenses,
    transactionCount: Number(row.transactionCount),
  };
}

export async function getMonthlySummary(
  db: Database,
  { ownerId, month }: Readonly<MonthlySummaryOptions>,
): Promise<MonthlySummary> {
  const summary = await getRangeSummary(db, {
    ownerId,
    ...monthBounds(month),
  });
  return { month, ...summary };
}

interface DailySummaryOptions {
  ownerId: string;
  /** Validated YYYY-MM-DD at the authenticated edge: a Bangkok calendar date. */
  date: string;
}

export async function getDailySummary(
  db: Database,
  { ownerId, date }: Readonly<DailySummaryOptions>,
): Promise<DailySummary> {
  const summary = await getRangeSummary(db, {
    ownerId,
    start: date,
    end: date,
  });
  return { date, ...summary };
}

interface CategorySpendingRow {
  id: string;
  name: string;
  sortOrder: number;
  parentId: string;
  parentName: string;
  parentSortOrder: number;
  isUncategorized: boolean;
  spending: string;
}

/**
 * Folds per-category sums, already in parent then child category order, into
 * parents carrying their own amount and their children's.
 */
function foldCategorySpending(rows: readonly Readonly<CategorySpendingRow>[]) {
  const parents = new Map<string, ParentCategorySpending>();
  for (const row of rows) {
    const amount = BigInt(row.spending);
    const parent = parents.get(row.parentId) ?? {
      id: row.parentId,
      name: row.parentName,
      sortOrder: row.parentSortOrder,
      isUncategorized: row.isUncategorized,
      spending: 0n,
      directSpending: 0n,
      children: [],
    };
    const isDirect = row.id === row.parentId;
    parents.set(row.parentId, {
      ...parent,
      spending: parent.spending + amount,
      directSpending: parent.directSpending + (isDirect ? amount : 0n),
      children: isDirect
        ? parent.children
        : [
            ...parent.children,
            {
              id: row.id,
              name: row.name,
              sortOrder: row.sortOrder,
              spending: amount,
            },
          ],
    });
  }
  return [...parents.values()];
}

/**
 * Category spending per expense parent (ADR 0012): the month's expenses less
 * its refunds, each counted under the expense's current category and rolled
 * up to its parent. Every expense and refund lands in exactly one category,
 * so the parents sum to the monthly summary's Net expenses by construction.
 */
export async function getCategorySpending(
  db: Database,
  { ownerId, month }: Readonly<MonthlySummaryOptions>,
): Promise<CategorySpending> {
  const { start, end } = monthBounds(month);
  const refundedExpenses = alias(transactions, "refunded_expenses");
  const parents = alias(categories, "parent_categories");
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
      parentId: parents.id,
      parentName: parents.name,
      parentSortOrder: parents.sortOrder,
      isUncategorized: parents.isProtected,
      spending: sql<string>`sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else -${transactions.amount} end)`,
    })
    .from(transactions)
    .leftJoin(
      refundedExpenses,
      eq(refundedExpenses.id, transactions.refundOfTransactionId),
    )
    .innerJoin(
      categories,
      eq(
        categories.id,
        sql`coalesce(${transactions.categoryId}, ${refundedExpenses.categoryId})`,
      ),
    )
    .innerJoin(
      parents,
      eq(parents.id, sql`coalesce(${categories.parentId}, ${categories.id})`),
    )
    .where(
      and(
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
        inArray(transactions.type, ["expense", "refund"]),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    )
    .groupBy(parents.id, categories.id)
    .orderBy(
      asc(parents.isProtected),
      asc(parents.sortOrder),
      asc(parents.name),
      asc(parents.id),
      asc(categories.sortOrder),
      asc(categories.name),
      asc(categories.id),
    );
  const parentSpending = foldCategorySpending(rows);
  return {
    month,
    netExpenses: parentSpending.reduce(
      (total, parent) => total + parent.spending,
      0n,
    ),
    parents: parentSpending,
  };
}

interface ClosingBalancesOptions extends MonthlySummaryOptions {
  /** One of the owner's wallets, archived ones included, to read beside the total. */
  walletId?: string;
}

/**
 * The total Closing balance for each day of a month through today in Bangkok
 * (ADR 0001): every wallet opened by that date, archived ones included, at its
 * opening plus every current transaction dated on or before it. A date before
 * every opening date has no total, and a future month has no days yet. With a
 * wallet, each day also carries that wallet's Closing balance, null before its
 * opening date; `null` when the owner has no wallet with that id.
 */
export async function getClosingBalances(
  db: Database,
  { ownerId, month, walletId }: Readonly<ClosingBalancesOptions>,
): Promise<ClosingBalances | null> {
  const { start, end } = monthBounds(month);
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  const last = earlierOf(end, today);
  const [openings, dailyMovements] = await Promise.all([
    db
      .select({
        id: wallets.id,
        openingAmount: wallets.openingAmount,
        openingDate: wallets.openingDate,
        movement: walletMovement,
      })
      .from(wallets)
      .leftJoin(
        transactions,
        movesWallet(lt(transactions.transactionDate, start)),
      )
      .where(eq(wallets.userId, ownerId))
      .groupBy(wallets.id),
    db
      .select({
        id: wallets.id,
        date: transactions.transactionDate,
        movement: walletMovement,
      })
      .from(wallets)
      .innerJoin(
        transactions,
        movesWallet(
          and(
            gte(transactions.transactionDate, start),
            lte(transactions.transactionDate, last),
          ),
        ),
      )
      .where(eq(wallets.userId, ownerId))
      .groupBy(wallets.id, transactions.transactionDate),
  ]);

  const compared =
    walletId === undefined
      ? undefined
      : // Postgres reads identifiers in either case; ids come back lowercase.
        openings.find((wallet) => wallet.id === walletId.toLowerCase());
  if (walletId !== undefined && !compared) {
    return null;
  }

  const balances = new Map(
    openings.map((wallet) => [
      wallet.id,
      wallet.openingAmount + BigInt(wallet.movement),
    ]),
  );
  const movementsByDate = Map.groupBy(dailyMovements, (row) => row.date);
  const entries: ClosingBalanceEntry[] = [];
  for (let date = start; date <= last; date = addDays(date, 1)) {
    for (const row of movementsByDate.get(date) ?? []) {
      balances.set(row.id, (balances.get(row.id) ?? 0n) + BigInt(row.movement));
    }
    const opened = openings.filter((wallet) => wallet.openingDate <= date);
    const total =
      opened.length === 0
        ? null
        : opened.reduce(
            (sum, wallet) => sum + (balances.get(wallet.id) ?? 0n),
            0n,
          );
    entries.push(
      compared
        ? {
            date,
            total,
            wallet:
              compared.openingDate <= date
                ? (balances.get(compared.id) ?? 0n)
                : null,
          }
        : { date, total },
    );
  }
  return { month, entries };
}
