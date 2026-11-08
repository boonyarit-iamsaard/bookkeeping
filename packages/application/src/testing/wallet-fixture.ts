import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import type { Result } from "@bookkeeping/domain/result";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import type { WalletRef } from "../wallets/wallet";
import { createWallet } from "../wallets/wallet";
import { changeWalletState } from "../wallets/wallet-state";

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
    savings: false,
    openingAmount: 1_000_000n,
    openingDate: "2026-09-01",
    idempotencyKey: randomUUID(),
  });
  if (!created.ok) {
    throw new Error(`Wallet fixture rejected: ${created.error.code}`);
  }
  return created.value.wallet;
}

/** Archives a fixture wallet, failing setup if the state change is rejected. */
export async function archiveForTest(
  db: Database,
  ref: Readonly<WalletRef>,
): Promise<Result<WalletSummary, never>> {
  const result = await changeWalletState(db, { ...ref, archived: true });
  if (!result.ok) {
    throw new Error(`Wallet archive fixture rejected: ${result.error.code}`);
  }
  return result;
}
