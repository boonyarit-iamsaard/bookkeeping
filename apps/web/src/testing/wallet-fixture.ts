import { randomUUID } from "node:crypto";
import type { CreateWalletInput } from "@bookkeeping/application/wallets";
import { createWallet } from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import type { WalletSummary } from "@bookkeeping/domain/wallets";

export type WalletFixtureInput = Omit<CreateWalletInput, "idempotencyKey">;

/** Opens a wallet through the application operation; each call is a fresh creation. */
export async function openWallet(
  db: Database,
  fixture: Readonly<WalletFixtureInput>,
): Promise<WalletSummary> {
  const created = await createWallet(db, {
    ...fixture,
    idempotencyKey: randomUUID(),
  });
  if (!created.ok) {
    throw new Error(`Wallet fixture rejected: ${created.error.code}`);
  }
  return created.value.wallet;
}
