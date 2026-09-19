import type {
  CreateTransactionError as ApplicationCreateTransactionError,
  CreateTransactionInput as ApplicationCreateTransactionInput,
  CreateTransactionOutcome as ApplicationCreateTransactionOutcome,
} from "@bookkeeping/application/transactions";
import {
  createTransaction as createApplicationTransaction,
  findTransaction,
} from "@bookkeeping/application/transactions";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  LinkedExpense,
  RefundSummary,
  TransactionChange,
  TransactionChangeAction,
  TransactionDetail,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@/features/transactions/money-limits";

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

/** The fields every transaction carries, whether created or edited. */
type TransactionFields = Pick<
  CreateTransactionInput,
  | "ownerId"
  | "type"
  | "walletId"
  | "categoryId"
  | "destinationWalletId"
  | "refundOfTransactionId"
  | "currency"
  | "amount"
  | "transactionDate"
  | "note"
>;

type FieldRejection = Exclude<
  CreateTransactionError,
  { code: "submission-conflict" }
>;

interface OwnedTransactionFields extends TransactionFields {
  /** Wallets an edit may keep even though they are archived: its own. */
  retainedWalletIds?: readonly string[];
  /** The refund being edited, whose own old amount does not count against it. */
  editingRefundId?: string;
}

/** The source wallet, plus the destination when the row is a transfer. */
function walletIdsOf(
  row: Readonly<{ walletId: string; destinationWalletId?: string | null }>,
): string[] {
  return row.destinationWalletId
    ? [row.walletId, row.destinationWalletId]
    : [row.walletId];
}

/**
 * Checks the wallet, category, and date against the owner's own records.
 * Runs inside the committing transaction so the rows it reads are the rows
 * the write lands on.
 */
async function validateAgainstOwner(
  tx: Database,
  input: Readonly<OwnedTransactionFields>,
): Promise<FieldRejection | undefined> {
  const shapeRejection =
    validateTransferShape(input) ?? validateRefundShape(input);
  if (shapeRejection) {
    return shapeRejection;
  }
  // The expense lock comes before the wallet locks everywhere, so refunds,
  // expense corrections, and wallet archiving never wait on each other in a cycle.
  const expense = await lockRefundedExpense(tx, input);
  if (!expense.ok) {
    return expense.error;
  }
  const owned = await lockOwnedWallets(tx, input);
  if (!owned.ok) {
    return owned.error;
  }
  const categoryRejection = await validateCategory(tx, input);
  if (categoryRejection) {
    return categoryRejection;
  }
  const dateRejection = validateDate(input.transactionDate, owned.value);
  if (dateRejection) {
    return dateRejection;
  }
  if (!expense.value) {
    return undefined;
  }
  return validateRefundAgainstExpense(tx, { input, expense: expense.value });
}

/** A refund names its expense and no category; nothing else names an expense. */
function validateRefundShape(
  input: Readonly<TransactionFields>,
): FieldRejection | undefined {
  if (input.type !== "refund") {
    return input.refundOfTransactionId ? { code: "invalid-refund" } : undefined;
  }
  if (!input.refundOfTransactionId || input.categoryId !== null) {
    return { code: "invalid-refund" };
  }
  return undefined;
}

/**
 * Exclusively locks the owner's current expense behind a refund for the rest
 * of the transaction. Concurrent refunds queue here, and so do the expense's
 * own corrections and deletion, which take the same lock.
 */
async function lockRefundedExpense(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<Result<LinkedExpense | undefined, FieldRejection>> {
  if (input.type !== "refund" || !input.refundOfTransactionId) {
    return ok(undefined);
  }
  const [expense] = await tx
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      deletedAt: transactions.deletedAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, input.refundOfTransactionId),
        eq(transactions.userId, input.ownerId),
      ),
    )
    .for("update");
  if (!expense || expense.deletedAt || expense.type !== "expense") {
    return err({ code: "expense-not-found" });
  }
  return ok(expense);
}

interface RefundCheck {
  input: Readonly<OwnedTransactionFields>;
  expense: Readonly<LinkedExpense>;
}

/** The refund lands on or after its expense and within what is left to refund. */
async function validateRefundAgainstExpense(
  tx: Database,
  { input, expense }: Readonly<RefundCheck>,
): Promise<FieldRejection | undefined> {
  if (input.transactionDate < expense.transactionDate) {
    return { code: "before-expense", expenseDate: expense.transactionDate };
  }
  const others = (await currentRefundsOf(tx, expense.id)).filter(
    (refund) => refund.id !== input.editingRefundId,
  );
  const remaining = expense.amount - sumOf(others);
  if (input.amount > remaining) {
    return { code: "exceeds-refundable", remaining };
  }
  return undefined;
}

/** Combined refund amounts, exact. */
function sumOf(refunds: readonly RefundSummary[]): bigint {
  return refunds.reduce((sum, refund) => sum + refund.amount, 0n);
}

/** A transfer names two distinct wallets in THB and no category; others name one wallet. */
function validateTransferShape(
  input: Readonly<TransactionFields>,
): FieldRejection | undefined {
  if (input.type !== "transfer") {
    return input.destinationWalletId ? { code: "invalid-transfer" } : undefined;
  }
  if (input.currency !== "THB") {
    return { code: "invalid-currency" };
  }
  if (!input.destinationWalletId || input.categoryId !== null) {
    return { code: "invalid-transfer" };
  }
  if (input.walletId === input.destinationWalletId) {
    return { code: "same-wallet" };
  }
  return undefined;
}

interface OwnedWallet {
  id: string;
  openingDate: CalendarDate;
  archivedAt: Date | null;
}

/**
 * Share-locks the owner's named wallets in a stable order and rejects a
 * missing or archived one; an edit may keep the archived wallets it already has.
 */
async function lockOwnedWallets(
  tx: Database,
  input: Readonly<OwnedTransactionFields>,
): Promise<Result<OwnedWallet[], FieldRejection>> {
  const ownedWallets = await tx
    .select({
      id: wallets.id,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
    })
    .from(wallets)
    .where(
      and(
        inArray(wallets.id, walletIdsOf(input)),
        eq(wallets.userId, input.ownerId),
      ),
    )
    .orderBy(asc(wallets.id))
    .for("share");
  const ownedIds = new Set(ownedWallets.map((wallet) => wallet.id));
  if (!ownedIds.has(input.walletId)) {
    return err({ code: "wallet-not-found" });
  }
  if (input.destinationWalletId && !ownedIds.has(input.destinationWalletId)) {
    return err({ code: "destination-wallet-not-found" });
  }
  const archived = ownedWallets.find(
    (wallet) =>
      wallet.archivedAt && !input.retainedWalletIds?.includes(wallet.id),
  );
  if (archived) {
    return err({ code: "wallet-archived", walletId: archived.id });
  }
  return ok(ownedWallets);
}

/**
 * Income and expenses need one of the owner's categories of the same kind.
 * The share lock holds the category's removal until this write lands, and
 * a removal already under way makes the category vanish here instead of
 * failing the foreign key.
 */
async function validateCategory(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<FieldRejection | undefined> {
  if (input.type === "transfer" || input.type === "refund") {
    return undefined;
  }
  if (!input.categoryId) {
    return { code: "category-not-found" };
  }
  const [category] = await tx
    .select({ kind: categories.kind })
    .from(categories)
    .where(
      and(
        eq(categories.id, input.categoryId),
        eq(categories.userId, input.ownerId),
      ),
    )
    .for("share");
  if (!category) {
    return { code: "category-not-found" };
  }
  if (category.kind !== input.type) {
    return { code: "category-kind-mismatch" };
  }
  return undefined;
}

/** The date is at most Bangkok today and inside every named wallet's history. */
function validateDate(
  transactionDate: CalendarDate,
  ownedWallets: readonly OwnedWallet[],
): FieldRejection | undefined {
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  if (transactionDate > today) {
    return { code: "future-date", today };
  }
  const unopened = ownedWallets.find(
    (wallet) => transactionDate < wallet.openingDate,
  );
  if (unopened) {
    return { code: "before-opening", openingDate: unopened.openingDate };
  }
  return undefined;
}

function validateShape(
  input: Readonly<Pick<TransactionFields, "amount" | "note">>,
): FieldRejection | undefined {
  if (
    input.amount < MIN_TRANSACTION_AMOUNT ||
    input.amount > MAX_TRANSACTION_AMOUNT
  ) {
    return { code: "amount-out-of-range" };
  }
  if (input.note.length > MAX_NOTE_LENGTH) {
    return { code: "note-too-long" };
  }
  return undefined;
}

interface UpdateTransactionInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  currency?: "THB";
  /** Integer satang, always positive; the stored type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export type UpdateTransactionError =
  /** Also covers another owner's record and a deleted one. */
  { code: "transaction-not-found" } | FieldRejection | ExpenseGuardRejection;

/** An expense cannot contradict the refunds already linked to it. */
export type ExpenseGuardRejection =
  | { code: "below-refunded"; refundedTotal: bigint }
  /** The earliest linked refund's date; the expense cannot move past it. */
  | { code: "after-refund"; refundDate: CalendarDate };

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

function sameSnapshot(
  a: Readonly<TransactionSnapshot>,
  b: Readonly<TransactionSnapshot>,
) {
  return (
    a.type === b.type &&
    a.walletId === b.walletId &&
    a.categoryId === b.categoryId &&
    a.destinationWalletId === b.destinationWalletId &&
    a.amount === b.amount &&
    a.transactionDate === b.transactionDate &&
    a.note === b.note
  );
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

/**
 * Corrects a transaction in place. The type is fixed; the wallet,
 * category, amount, date, and note are re-validated against the owner's
 * records inside the committing transaction. The recording time is kept
 * and the before/after snapshots are written with the change, so history
 * and balances can never disagree. An edit that changes nothing succeeds
 * and leaves no history.
 */
export async function updateTransaction(
  db: Database,
  input: Readonly<UpdateTransactionInput>,
): Promise<Result<TransactionDetail, UpdateTransactionError>> {
  const invalid = validateShape(input);
  if (invalid) {
    return err(invalid);
  }

  let rejection: UpdateTransactionError | undefined;
  await db.transaction(async (tx) => {
    const current = await lockCurrentTransaction(tx, input);
    if (!current || current.deletedAt) {
      rejection = { code: "transaction-not-found" };
      return;
    }
    const before = snapshotOf(current);
    const after = {
      type: current.type,
      walletId: input.walletId,
      categoryId: input.categoryId,
      ...(current.type === "transfer"
        ? { destinationWalletId: input.destinationWalletId }
        : {}),
      ...(current.type === "refund"
        ? { refundOfTransactionId: current.refundOfTransactionId }
        : {}),
      amount: input.amount.toString(),
      transactionDate: input.transactionDate,
      note: input.note,
    } satisfies TransactionSnapshot;
    rejection = await validateAgainstOwner(tx, {
      ...input,
      type: current.type,
      // The link is fixed with the type; the input cannot repoint a refund.
      refundOfTransactionId: current.refundOfTransactionId,
      retainedWalletIds: walletIdsOf(current),
      editingRefundId: current.type === "refund" ? current.id : undefined,
    });
    if (rejection) {
      return;
    }
    rejection = await guardRefundedExpense(tx, { current, input });
    if (rejection) {
      return;
    }
    if (sameSnapshot(before, after)) {
      return;
    }
    await tx
      .update(transactions)
      .set({
        walletId: input.walletId,
        categoryId: input.categoryId,
        destinationWalletId: input.destinationWalletId ?? null,
        amount: input.amount,
        transactionDate: input.transactionDate,
        note: input.note,
      })
      .where(eq(transactions.id, current.id));
    await recordChange(tx, {
      ownerId: input.ownerId,
      transactionId: current.id,
      action: "edit",
      before,
      after,
    });
  });

  if (rejection) {
    return err(rejection);
  }
  const transaction = await findTransaction(db, input);
  if (!transaction) {
    throw new Error("Edited transaction could not be read back");
  }
  return ok(transaction);
}

interface ExpenseGuardCheck {
  current: Readonly<{ id: string; type: TransactionType }>;
  input: Readonly<Pick<UpdateTransactionInput, "amount" | "transactionDate">>;
}

/**
 * With the expense locked, checks that its new amount still covers every
 * linked refund and that no refund would come to predate it.
 */
async function guardRefundedExpense(
  tx: Database,
  { current, input }: Readonly<ExpenseGuardCheck>,
): Promise<ExpenseGuardRejection | undefined> {
  if (current.type !== "expense") {
    return undefined;
  }
  const refunds = await currentRefundsOf(tx, current.id);
  if (refunds.length === 0) {
    return undefined;
  }
  const refundedTotal = sumOf(refunds);
  if (input.amount < refundedTotal) {
    return { code: "below-refunded", refundedTotal };
  }
  const earliest = refunds.reduce((first, refund) =>
    refund.transactionDate < first.transactionDate ? refund : first,
  );
  if (input.transactionDate > earliest.transactionDate) {
    return { code: "after-refund", refundDate: earliest.transactionDate };
  }
  return undefined;
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

interface ListTransactionChangesOptions {
  ownerId: string;
  id: string;
}

/** The internal change history of one transaction, oldest first. Not for normal views. */
export async function listTransactionChanges(
  db: Database,
  { ownerId, id }: Readonly<ListTransactionChangesOptions>,
): Promise<readonly TransactionChange[]> {
  return db
    .select({
      action: transactionChanges.action,
      before: transactionChanges.before,
      after: transactionChanges.after,
      changedAt: transactionChanges.changedAt,
    })
    .from(transactionChanges)
    .where(
      and(
        eq(transactionChanges.transactionId, id),
        eq(transactionChanges.userId, ownerId),
      ),
    )
    .orderBy(asc(transactionChanges.changedAt), asc(transactionChanges.id));
}
