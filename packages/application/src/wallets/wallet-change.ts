import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type {
  WalletSnapshot,
  WalletSummary,
} from "@bookkeeping/domain/wallets";
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

type WalletRow = typeof wallets.$inferSelect;
type WalletChangeAction =
  | "opening"
  | "archive"
  | "unarchive"
  | "mark-savings"
  | "unmark-savings";

interface WalletChangeRef {
  ownerId: string;
  id: string;
}

function snapshotWallet(
  row: Readonly<
    Pick<WalletRow, "openingAmount" | "openingDate" | "archivedAt" | "savings">
  >,
): WalletSnapshot {
  return {
    openingAmount: row.openingAmount.toString(),
    openingDate: row.openingDate,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    savings: row.savings,
  };
}

/**
 * Loads the owned wallet under an exclusive row lock, so concurrent state
 * changes serialize and every change applies to what was read.
 */
export async function loadWalletForUpdate(
  db: Database,
  ref: Readonly<WalletChangeRef>,
): Promise<WalletRow | null> {
  const [current] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, ref.id), eq(wallets.userId, ref.ownerId)))
    .for("update");
  return current ?? null;
}

/**
 * Writes one wallet change inside the caller's transaction. The update
 * targets the locked row, so its disappearance is a fault rather than a
 * silent miss.
 */
export async function updateWallet(
  db: Database,
  change: Readonly<{
    id: string;
    set:
      | { archivedAt: Date | null }
      | { savings: boolean }
      | Pick<WalletRow, "openingAmount" | "openingDate">;
  }>,
): Promise<WalletRow> {
  const [updated] = await db
    .update(wallets)
    .set(change.set)
    .where(eq(wallets.id, change.id))
    .returning();
  if (!updated) {
    throw new Error("Locked wallet disappeared");
  }
  return updated;
}

/** Retains the before and after of a wallet change in internal history. */
export async function recordWalletChange(
  db: Database,
  change: Readonly<{
    ref: WalletChangeRef;
    action: WalletChangeAction;
    before: WalletRow;
    after: WalletRow;
  }>,
): Promise<void> {
  await db.insert(walletChanges).values({
    userId: change.ref.ownerId,
    walletId: change.ref.id,
    action: change.action,
    before: snapshotWallet(change.before),
    after: snapshotWallet(change.after),
  });
}

/**
 * Reads the updated wallet through the shared balance query. The wallet is
 * locked for the whole transaction, so its absence is a fault.
 */
export async function readWalletSummaryAfterChange(
  db: Database,
  ref: Readonly<WalletChangeRef>,
): Promise<WalletSummary> {
  const [wallet] = await selectWalletSummaries(db, {
    ownerId: ref.ownerId,
    asOf: todayIn({ timeZone: APP_TIME_ZONE }),
    filter: eq(wallets.id, ref.id),
  });
  if (!wallet) {
    throw new Error("Locked wallet disappeared");
  }
  return wallet;
}
