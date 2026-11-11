import { randomUUID } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import type { WalletSummary, WalletType } from "@bookkeeping/domain/wallets";
import type { WalletRef } from "../wallets/wallet";
import { createWallet } from "../wallets/wallet";
import { changeWalletState } from "../wallets/wallet-state";

export interface WalletFixtureInput {
  ownerId: string;
  name?: string;
  type?: WalletType;
  savings?: boolean;
  openingAmount?: bigint;
  openingDate?: CalendarDate;
}

function withDefaults(input: Readonly<WalletFixtureInput>) {
  return {
    ownerId: input.ownerId,
    name: input.name ?? "Cash",
    type: input.type ?? "cash",
    savings: input.savings ?? false,
    openingAmount: input.openingAmount ?? 1_000_000n,
    openingDate: input.openingDate ?? "2026-09-01",
  };
}

/** Creates a wallet through the shared operation under a fresh key. */
export async function createWalletForTest(
  db: Database,
  input: Readonly<WalletFixtureInput>,
): Promise<WalletSummary> {
  const created = await createWallet(db, {
    ...withDefaults(input),
    idempotencyKey: randomUUID(),
  });
  if (!created.ok) {
    throw new Error(`Wallet fixture rejected: ${created.error.code}`);
  }
  return created.value;
}

/**
 * Inserts a wallet row the creation operation would refuse, such as an
 * opening beyond the money range or one dated after a faked today.
 */
export async function insertWalletRowForTest(
  db: Database,
  input: Readonly<WalletFixtureInput>,
): Promise<string> {
  const { ownerId, ...wallet } = withDefaults(input);
  const [row] = await db
    .insert(wallets)
    .values({ userId: ownerId, ...wallet })
    .returning({ id: wallets.id });
  if (!row) {
    throw new Error("Wallet insert returned no row");
  }
  return row.id;
}

/**
 * Archives a fixture wallet, failing setup if the state change is rejected.
 * It stays a Result so a test can race it against operations that return one.
 */
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
