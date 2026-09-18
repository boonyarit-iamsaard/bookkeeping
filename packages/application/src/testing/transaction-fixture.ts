import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";

export interface RetainedTransferFixture {
  ownerId: string;
  currentWalletId: string;
  currentDestinationWalletId: string;
  retainedWalletId: string;
}

/**
 * Persists a transfer whose edit history still names `retainedWalletId`:
 * the wallet is no longer current, yet a retained snapshot references it.
 */
export async function insertRetainedTransferSnapshot(
  db: Database,
  fixture: Readonly<RetainedTransferFixture>,
): Promise<void> {
  const [transaction] = await db
    .insert(transactions)
    .values({
      userId: fixture.ownerId,
      type: "transfer",
      walletId: fixture.currentWalletId,
      destinationWalletId: fixture.currentDestinationWalletId,
      currency: "THB",
      amount: 100n,
      transactionDate: "2026-09-02",
    })
    .returning({ id: transactions.id });
  if (!transaction) {
    throw new Error("Transfer insert returned no row");
  }
  await db.insert(transactionChanges).values({
    userId: fixture.ownerId,
    transactionId: transaction.id,
    action: "edit",
    before: {
      type: "transfer",
      walletId: fixture.retainedWalletId,
      categoryId: null,
      destinationWalletId: fixture.currentDestinationWalletId,
      amount: "100",
      transactionDate: "2026-09-02",
      note: "",
    },
    after: {
      type: "transfer",
      walletId: fixture.currentWalletId,
      categoryId: null,
      destinationWalletId: fixture.currentDestinationWalletId,
      amount: "100",
      transactionDate: "2026-09-02",
      note: "",
    },
  });
}
