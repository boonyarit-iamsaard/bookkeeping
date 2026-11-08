import type { Database } from "@bookkeeping/database/connection";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type {
  WalletSnapshot,
  WalletSummary,
} from "@bookkeeping/domain/wallets";
import { and, eq } from "drizzle-orm";
import type { WalletRef } from "./wallet";
import { selectWalletSummaries } from "./wallet-balance";

type WalletRow = typeof wallets.$inferSelect;
type WalletChangeAction =
  | "opening"
  | "archive"
  | "unarchive"
  | "mark-savings"
  | "unmark-savings";

interface WalletUpdate {
  id: string;
  set:
    | { archivedAt: Date | null }
    | { savings: boolean }
    | Pick<WalletRow, "openingAmount" | "openingDate">;
}

interface WalletChangeRecord {
  ref: WalletRef;
  action: WalletChangeAction;
  before: WalletRow;
  after: WalletRow;
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
  ref: Readonly<WalletRef>,
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
  change: Readonly<WalletUpdate>,
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
  change: Readonly<WalletChangeRecord>,
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
  ref: Readonly<WalletRef>,
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
