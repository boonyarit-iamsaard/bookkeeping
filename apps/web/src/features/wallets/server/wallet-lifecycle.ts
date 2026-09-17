import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type { WalletSnapshot } from "@bookkeeping/domain/wallets";
import { and, eq, or, sql } from "drizzle-orm";

export interface ManageWalletInput {
  ownerId: string;
  id: string;
}
export interface SetWalletArchivedInput extends ManageWalletInput {
  archived: boolean;
}
export type WalletLifecycleError = "wallet-not-found" | "history-remains";
type Outcome = Result<{ id: string }, WalletLifecycleError>;

function snapshot(
  row: Readonly<{
    openingAmount: bigint;
    openingDate: string;
    archivedAt: Date | null;
  }>,
): WalletSnapshot {
  return {
    openingAmount: row.openingAmount.toString(),
    openingDate: row.openingDate,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

async function lockWallet(db: Database, input: Readonly<ManageWalletInput>) {
  const [row] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, input.id), eq(wallets.userId, input.ownerId)))
    .for("update");
  return row;
}

export async function setWalletArchived(
  db: Database,
  input: Readonly<SetWalletArchivedInput>,
): Promise<Outcome> {
  return db.transaction(async (tx) => {
    const current = await lockWallet(tx, input);
    if (!current) {
      return err("wallet-not-found");
    }
    if (Boolean(current.archivedAt) === input.archived) {
      return ok({ id: input.id });
    }
    const [updated] = await tx
      .update(wallets)
      .set({ archivedAt: input.archived ? new Date() : null })
      .where(eq(wallets.id, input.id))
      .returning();
    if (!updated) {
      throw new Error("Locked wallet disappeared");
    }
    await tx.insert(walletChanges).values({
      userId: input.ownerId,
      walletId: input.id,
      action: input.archived ? "archive" : "unarchive",
      before: snapshot(current),
      after: snapshot(updated),
    });
    return ok({ id: input.id });
  });
}

export async function deleteWallet(
  db: Database,
  input: Readonly<ManageWalletInput>,
): Promise<Outcome> {
  return db.transaction(async (tx) => {
    const current = await lockWallet(tx, input);
    if (!current) {
      return err("wallet-not-found");
    }
    const [movement] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        or(
          eq(transactions.walletId, input.id),
          eq(transactions.destinationWalletId, input.id),
        ),
      )
      .limit(1);
    const [change] = await tx
      .select({ id: walletChanges.id })
      .from(walletChanges)
      .where(eq(walletChanges.walletId, input.id))
      .limit(1);
    // A corrected transaction may now point elsewhere; its snapshots still reference this wallet.
    const [retained] = await tx
      .select({ id: transactionChanges.id })
      .from(transactionChanges)
      .where(
        sql`${transactionChanges.before}->>'walletId' = ${input.id} or ${transactionChanges.before}->>'destinationWalletId' = ${input.id} or ${transactionChanges.after}->>'walletId' = ${input.id} or ${transactionChanges.after}->>'destinationWalletId' = ${input.id}`,
      )
      .limit(1);
    if (movement || change || retained) {
      return err("history-remains");
    }
    await tx.delete(wallets).where(eq(wallets.id, input.id));
    return ok({ id: input.id });
  });
}
