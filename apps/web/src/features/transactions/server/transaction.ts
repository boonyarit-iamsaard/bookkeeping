import type {
  CreateTransactionError as ApplicationCreateTransactionError,
  CreateTransactionInput as ApplicationCreateTransactionInput,
  CreateTransactionOutcome as ApplicationCreateTransactionOutcome,
} from "@bookkeeping/application/transactions";
import { createTransaction as createApplicationTransaction } from "@bookkeeping/application/transactions";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  RefundSummary,
  TransactionChangeAction,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import { and, asc, eq, isNull } from "drizzle-orm";

export interface CreateTransactionInput
  extends Omit<ApplicationCreateTransactionInput, "idempotencyKey"> {
  /** Legacy name retained for existing Next.js form fixtures. */
  submissionKey: string;
}

export type CreateTransactionOutcome = ApplicationCreateTransactionOutcome;

/** The old adapter name maps the application conflict for existing callers. */
export type CreateTransactionError =
  | Exclude<ApplicationCreateTransactionError, { code: "idempotency-conflict" }>
  | { code: "submission-conflict" };

/**
 * Temporary Next.js compatibility adapter. The creation operation and all
 * financial validation live in `@bookkeeping/application`; this wrapper only
 * translates the legacy form key name and conflict code.
 */
export async function createTransaction(
  db: Database,
  input: Readonly<CreateTransactionInput>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  const { submissionKey, ...command } = input;
  const outcome = await createApplicationTransaction(db, {
    ...command,
    idempotencyKey: submissionKey,
  });
  if (!outcome.ok) {
    if (outcome.error.code === "idempotency-conflict") {
      return err({ code: "submission-conflict" });
    }
    return err(outcome.error);
  }
  return outcome;
}

interface SnapshotInput {
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  refundOfTransactionId?: string | null;
  currency?: "THB";
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

function snapshotOf(row: Readonly<SnapshotInput>): TransactionSnapshot {
  return {
    type: row.type,
    walletId: row.walletId,
    categoryId: row.categoryId,
    ...(row.type === "transfer"
      ? { destinationWalletId: row.destinationWalletId }
      : {}),
    ...(row.type === "refund"
      ? { refundOfTransactionId: row.refundOfTransactionId }
      : {}),
    amount: row.amount.toString(),
    transactionDate: row.transactionDate,
    note: row.note,
  };
}

/**
 * Locks the owner's current (undeleted) transaction for the rest of the
 * transaction, so concurrent edits and deletions apply one after another.
 */
async function lockCurrentTransaction(
  tx: Database,
  { ownerId, id }: Readonly<{ ownerId: string; id: string }>,
) {
  const [row] = await tx
    .select({
      id: transactions.id,
      type: transactions.type,
      walletId: transactions.walletId,
      categoryId: transactions.categoryId,
      destinationWalletId: transactions.destinationWalletId,
      refundOfTransactionId: transactions.refundOfTransactionId,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      note: transactions.note,
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, ownerId)))
    .for("update");
  return row;
}

/** The nondeleted refunds linked to an expense, oldest date first. */
async function currentRefundsOf(
  tx: Database,
  expenseId: string,
): Promise<readonly RefundSummary[]> {
  const rows = await tx
    .select({
      id: transactions.id,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      walletId: wallets.id,
      walletName: wallets.name,
      walletType: wallets.type,
      walletArchivedAt: wallets.archivedAt,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .where(
      and(
        eq(transactions.refundOfTransactionId, expenseId),
        isNull(transactions.deletedAt),
      ),
    )
    .orderBy(
      asc(transactions.transactionDate),
      asc(transactions.recordedAt),
      asc(transactions.id),
    );
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    transactionDate: row.transactionDate,
    wallet: {
      id: row.walletId,
      name: row.walletName,
      type: row.walletType,
      archived: Boolean(row.walletArchivedAt),
    },
  }));
}

interface DeleteTransactionOptions {
  ownerId: string;
  id: string;
}

export type DeleteTransactionError =
  | { code: "transaction-not-found" }
  /** An expense keeps its row while any of these refunds still count. */
  | { code: "refunds-exist"; refunds: readonly RefundSummary[] };

/**
 * Soft-deletes a transaction: it leaves lists, detail, and every
 * balance, while the row and its receipts stay so a late create retry
 * confirms the original outcome instead of recreating it. Deleting an
 * already-deleted transaction is the same outcome, without new history.
 */
export async function deleteTransaction(
  db: Database,
  { ownerId, id }: Readonly<DeleteTransactionOptions>,
): Promise<Result<{ id: string }, DeleteTransactionError>> {
  let found = false;
  let blocking: readonly RefundSummary[] = [];
  await db.transaction(async (tx) => {
    const current = await lockCurrentTransaction(tx, { ownerId, id });
    if (!current) {
      return;
    }
    found = true;
    if (current.deletedAt) {
      return;
    }
    if (current.type === "expense") {
      blocking = await currentRefundsOf(tx, current.id);
      if (blocking.length > 0) {
        return;
      }
    }
    await tx
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, current.id));
    await recordChange(tx, {
      ownerId,
      transactionId: current.id,
      action: "delete",
      before: snapshotOf(current),
      after: null,
    });
  });
  if (!found) {
    return err({ code: "transaction-not-found" });
  }
  if (blocking.length > 0) {
    return err({ code: "refunds-exist", refunds: blocking });
  }
  return ok({ id });
}

interface RecordChangeInput {
  ownerId: string;
  transactionId: string;
  action: TransactionChangeAction;
  before: TransactionSnapshot;
  after: TransactionSnapshot | null;
}

async function recordChange(tx: Database, input: Readonly<RecordChangeInput>) {
  await tx.insert(transactionChanges).values({
    userId: input.ownerId,
    transactionId: input.transactionId,
    action: input.action,
    before: input.before,
    after: input.after,
  });
}
