import type { Database } from "@bookkeeping/database/connection";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { WalletSummary, WalletType } from "@bookkeeping/domain/wallets";

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
