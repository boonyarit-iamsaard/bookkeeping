import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/core/database/database";
import { transactions } from "@/core/database/schema/transactions";
import { wallets } from "@/core/database/schema/wallets";
import type {
  WalletSummary,
  WalletType,
} from "@/features/wallets/wallet.types";
import type { CalendarDate } from "@/shared/helpers/dates";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";

export interface CreateWalletInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  name: string;
  type: WalletType;
  /** Integer satang; zero and negative openings are valid. */
  openingAmount: bigint;
  openingDate: CalendarDate;
}

export async function createWallet(
  db: Database,
  input: Readonly<CreateWalletInput>,
): Promise<WalletSummary> {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: input.ownerId,
      name: input.name,
      type: input.type,
      currency: "THB",
      openingAmount: input.openingAmount,
      openingDate: input.openingDate,
    })
    .returning();
  if (!row) {
    throw new Error("Wallet insert returned no row");
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: "THB",
    openingAmount: row.openingAmount,
    openingDate: row.openingDate,
    archivedAt: row.archivedAt,
    balance:
      row.openingDate <= todayIn({ timeZone: APP_TIME_ZONE })
        ? row.openingAmount
        : 0n,
  };
}

interface ListWalletsOptions {
  ownerId: string;
  /** End-of-day balances through this date; defaults to today in Bangkok. */
  asOf?: CalendarDate;
}

/**
 * Wallets in deterministic picker order with end-of-day balances: the opening
 * (once opened) plus income minus expenses through `asOf`. Recording time
 * plays no part; only transaction dates do.
 */
export async function listWallets(
  db: Database,
  {
    ownerId,
    asOf = todayIn({ timeZone: APP_TIME_ZONE }),
  }: Readonly<ListWalletsOptions>,
): Promise<readonly WalletSummary[]> {
  const movement = sql<string>`coalesce(sum(case ${transactions.type}
    when 'income' then ${transactions.amount}
    when 'expense' then -${transactions.amount}
    when 'refund' then ${transactions.amount}
    when 'transfer' then case when ${transactions.walletId} = ${wallets.id} then -${transactions.amount} else ${transactions.amount} end
    else 0 end), 0)`;
  const rows = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      type: wallets.type,
      openingAmount: wallets.openingAmount,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
      movement,
    })
    .from(wallets)
    .leftJoin(
      transactions,
      and(
        or(
          eq(transactions.walletId, wallets.id),
          eq(transactions.destinationWalletId, wallets.id),
        ),
        isNull(transactions.deletedAt),
        lte(transactions.transactionDate, asOf),
      ),
    )
    .where(eq(wallets.userId, ownerId))
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
    balance:
      row.openingDate <= asOf ? row.openingAmount + BigInt(row.movement) : 0n,
  }));
}
