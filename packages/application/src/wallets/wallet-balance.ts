import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

interface WalletSummaryQuery {
  ownerId: string;
  asOf: CalendarDate;
  /** Narrows beyond ownership; the owner condition is always applied. */
  filter?: SQL;
}

/**
 * The signed sum of the joined transactions' effect on `wallets.id`, as a
 * decimal string; zero when none joined. Pair it with `movesWallet`.
 */
export const walletMovement = sql<string>`coalesce(sum(case ${transactions.type}
    when 'income' then ${transactions.amount}
    when 'expense' then -${transactions.amount}
    when 'refund' then ${transactions.amount}
    when 'transfer' then case when ${transactions.walletId} = ${wallets.id} then -${transactions.amount} else ${transactions.amount} end
    else 0 end), 0)`;

/** Joins the current transactions that move `wallets.id`, narrowed by `filter`. */
export function movesWallet(filter: SQL | undefined) {
  return and(
    or(
      eq(transactions.walletId, wallets.id),
      eq(transactions.destinationWalletId, wallets.id),
    ),
    isNull(transactions.deletedAt),
    filter,
  );
}

export async function selectWalletSummaries(
  db: Database,
  { ownerId, asOf, filter }: Readonly<WalletSummaryQuery>,
): Promise<WalletSummary[]> {
  const rows = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      type: wallets.type,
      openingAmount: wallets.openingAmount,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
      savings: wallets.savings,
      movement: walletMovement,
    })
    .from(wallets)
    .leftJoin(
      transactions,
      movesWallet(lte(transactions.transactionDate, asOf)),
    )
    .where(and(eq(wallets.userId, ownerId), filter))
    .groupBy(wallets.id)
    .orderBy(asc(wallets.createdAt), asc(wallets.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    currency: "THB",
    openingAmount: row.openingAmount,
    openingDate: row.openingDate,
    archivedAt: row.archivedAt,
    savings: row.savings,
    balance:
      row.openingDate <= asOf ? row.openingAmount + BigInt(row.movement) : 0n,
  }));
}
