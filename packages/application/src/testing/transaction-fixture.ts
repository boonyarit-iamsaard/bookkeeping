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

export interface CategorizedTransactionFixture {
  ownerId: string;
  walletId: string;
  categoryId: string;
  type?: "income" | "expense";
  amount?: bigint;
}

/**
 * Persists an income or expense row directly, without the creation history
 * the later transaction operations own; usage reads count exactly these rows.
 */
export async function insertCategorizedTransaction(
  db: Database,
  fixture: Readonly<CategorizedTransactionFixture>,
): Promise<string> {
  const [row] = await db
    .insert(transactions)
    .values({
      userId: fixture.ownerId,
      type: fixture.type ?? "expense",
      walletId: fixture.walletId,
      categoryId: fixture.categoryId,
      currency: "THB",
      amount: fixture.amount ?? 5_000n,
      transactionDate: "2026-09-02",
    })
    .returning({ id: transactions.id });
  if (!row) {
    throw new Error("Transaction insert returned no row");
  }
  return row.id;
}

export interface LinkedRefundFixture {
  ownerId: string;
  walletId: string;
  refundOfTransactionId: string;
  amount?: bigint;
}

/**
 * Persists a refund row directly, linked to its expense; the schema forces
 * its category to null, so usage reads never count it.
 */
export async function insertLinkedRefund(
  db: Database,
  fixture: Readonly<LinkedRefundFixture>,
): Promise<string> {
  const [row] = await db
    .insert(transactions)
    .values({
      userId: fixture.ownerId,
      type: "refund",
      walletId: fixture.walletId,
      refundOfTransactionId: fixture.refundOfTransactionId,
      currency: "THB",
      amount: fixture.amount ?? 2_000n,
      transactionDate: "2026-09-03",
    })
    .returning({ id: transactions.id });
  if (!row) {
    throw new Error("Refund insert returned no row");
  }
  return row.id;
}
