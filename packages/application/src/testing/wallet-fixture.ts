import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import { createWallet } from "../wallets/wallet";

export interface WalletFixtureInput {
  ownerId: string;
}

/** Creates a cash wallet through the shared operation under a fresh key. */
export async function createWalletForTest(
  db: Database,
  { ownerId }: Readonly<WalletFixtureInput>,
): Promise<WalletSummary> {
  const created = await createWallet(db, {
    ownerId,
    name: "Cash",
    type: "cash",
    openingAmount: 1_000_000n,
    openingDate: "2026-09-01",
    idempotencyKey: randomUUID(),
  });
  if (!created.ok) {
    throw new Error(`Wallet fixture rejected: ${created.error.code}`);
  }
  return created.value.wallet;
}
