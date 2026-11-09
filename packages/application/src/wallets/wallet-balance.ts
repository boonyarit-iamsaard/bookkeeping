import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletBalance, WalletSummary } from "@bookkeeping/domain/wallets";
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

/** What a Closing balance is worked out from: the opening and the movement through the date. */
export interface WalletClosingFacts {
  openingAmount: bigint;
  openingDate: CalendarDate;
  /** The signed effect of the current transactions dated on or before the date. */
  movement: bigint;
}

/**
 * A Wallet's Closing balance on `date`, or `null` before its opening date:
 * it was not yet tracked, which is not the same as holding zero.
 */
export function walletClosingBalance(
  { openingAmount, openingDate, movement }: Readonly<WalletClosingFacts>,
  date: CalendarDate,
): bigint | null {
  if (date < openingDate) {
    return null;
  }
  return openingAmount + movement;
}

/** A Wallet as the balance split sees it: its kind and its Closing balance, if any. */
export interface WalletBalanceFacts {
  savings: boolean;
  balance: bigint | null;
}

/**
 * The Total balance, Spendable and Set aside: the signed sums of the opened
 * Wallets' Closing balances, archived ones included.
 */
export function summarizeWalletBalance(
  facts: readonly Readonly<WalletBalanceFacts>[],
): WalletBalance {
  let spendable = 0n;
  let setAside = 0n;
  let spendableWalletCount = 0;
  let savingsWalletCount = 0;
  for (const { savings, balance } of facts) {
    if (balance === null) {
      continue;
    }
    if (savings) {
      setAside += balance;
      savingsWalletCount += 1;
    } else {
      spendable += balance;
      spendableWalletCount += 1;
    }
  }
  const walletCount = spendableWalletCount + savingsWalletCount;
  return {
    total: walletCount === 0 ? null : spendable + setAside,
    spendable: spendableWalletCount === 0 ? null : spendable,
    setAside: savingsWalletCount === 0 ? null : setAside,
    walletCount,
    spendableWalletCount,
    savingsWalletCount,
  };
}

/**
 * The owner's Wallets that have a Closing balance on `asOf`, in picker order:
 * a Wallet not yet opened by then is left out.
 */
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
  return rows.flatMap((row) => {
    const balance = walletClosingBalance(
      { ...row, movement: BigInt(row.movement) },
      asOf,
    );
    if (balance === null) {
      return [];
    }
    return [
      {
        id: row.id,
        name: row.name,
        type: row.type,
        currency: "THB",
        openingAmount: row.openingAmount,
        openingDate: row.openingDate,
        archivedAt: row.archivedAt,
        savings: row.savings,
        balance,
      },
    ];
  });
}
