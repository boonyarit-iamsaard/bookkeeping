import { asc, eq } from "drizzle-orm";
import type { Database } from "@/core/database/database";
import type { WalletType } from "@/core/database/schema/wallet-type";
import { wallets } from "@/core/database/schema/wallets";
import type { CalendarDate } from "@/shared/helpers/dates";
import { todayInBangkok } from "@/shared/helpers/dates";

export interface CreateWalletInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  name: string;
  type: WalletType;
  /** Integer satang; zero and negative openings are valid. */
  openingAmount: bigint;
  openingDate: CalendarDate;
}

export interface WalletSummary {
  id: string;
  name: string;
  type: WalletType;
  currency: "THB";
  openingAmount: bigint;
  openingDate: CalendarDate;
  /** Derived: opening balance plus current transactions (none yet). */
  balance: bigint;
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
  return toSummary(row);
}

export async function listWallets(
  db: Database,
  ownerId: string,
): Promise<readonly WalletSummary[]> {
  const rows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, ownerId))
    .orderBy(asc(wallets.createdAt), asc(wallets.id));
  return rows.map(toSummary);
}

function toSummary(row: Readonly<typeof wallets.$inferSelect>): WalletSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: "THB",
    openingAmount: row.openingAmount,
    openingDate: row.openingDate,
    balance: row.openingDate <= todayInBangkok() ? row.openingAmount : 0n,
  };
}
