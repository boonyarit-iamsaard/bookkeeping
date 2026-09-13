import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/core/database/database";
import { categories } from "@/core/database/schema/categories";
import {
  submissionReceipts,
  transactionChanges,
  transactions,
} from "@/core/database/schema/transactions";
import { wallets } from "@/core/database/schema/wallets";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@/features/transactions/money-limits";
import type {
  TransactionChange,
  TransactionChangeAction,
  TransactionDetail,
  TransactionSnapshot,
  TransactionType,
} from "@/features/transactions/transaction.types";
import type { CalendarDate } from "@/shared/helpers/dates";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";
import type { Result } from "@/shared/helpers/result";
import { err, ok } from "@/shared/helpers/result";

const CREATE_OPERATION = "transactions.create";

export interface CreateTransactionInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** One key per logical submission; a retry replays the same key. */
  submissionKey: string;
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  currency?: "THB";
  /** Integer satang, always positive; the type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export type CreateTransactionError =
  | { code: "wallet-not-found" }
  | { code: "destination-wallet-not-found" }
  | { code: "same-wallet" }
  | { code: "wallet-archived"; walletId: string }
  | { code: "invalid-currency" }
  | { code: "invalid-transfer" }
  | { code: "category-not-found" }
  | { code: "category-kind-mismatch" }
  | { code: "amount-out-of-range" }
  | { code: "note-too-long" }
  | { code: "future-date"; today: CalendarDate }
  | { code: "before-opening"; openingDate: CalendarDate }
  /** The same key was already used with a different payload. */
  | { code: "submission-conflict" };

export interface CreateTransactionOutcome {
  transaction: TransactionDetail;
  /** True when the key had already committed and no new record was made. */
  replayed: boolean;
}

const REPLAY = Symbol("replay");

/**
 * Records one income, expense, or transfer. Validation runs inside the committing
 * transaction against the owner's own wallet and category, and the receipt is
 * committed with the record, so a retry finds both or neither.
 */
export async function createTransaction(
  db: Database,
  input: Readonly<CreateTransactionInput>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  const fingerprint = fingerprintPayload(input);
  const existing = await findReceipt(db, input);
  if (existing) {
    return replay(db, { input, receipt: existing, fingerprint });
  }

  const invalid = validateShape(input);
  if (invalid) {
    return err(invalid);
  }

  let inserted: string | undefined;
  let rejection: CreateTransactionError | undefined;
  try {
    await db.transaction(async (tx) => {
      rejection = await validateAgainstOwner(tx, input);
      if (rejection) {
        return;
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          userId: input.ownerId,
          type: input.type,
          walletId: input.walletId,
          categoryId: input.categoryId,
          destinationWalletId: input.destinationWalletId,
          currency: "THB",
          amount: input.amount,
          transactionDate: input.transactionDate,
          note: input.note,
        })
        .returning({ id: transactions.id });
      if (!row) {
        throw new Error("Transaction insert returned no row");
      }
      // A concurrent duplicate blocks here until this transaction settles,
      // then loses the unique index and rolls its own insert back.
      const receipt = await tx
        .insert(submissionReceipts)
        .values({
          userId: input.ownerId,
          operation: CREATE_OPERATION,
          key: input.submissionKey,
          payloadFingerprint: fingerprint,
          transactionId: row.id,
        })
        .onConflictDoNothing()
        .returning({ id: submissionReceipts.id });
      if (receipt.length === 0) {
        throw REPLAY;
      }
      inserted = row.id;
    });
  } catch (error) {
    if (error !== REPLAY) {
      throw error;
    }
  }

  if (rejection) {
    return err(rejection);
  }
  if (inserted) {
    const transaction = await getTransaction(db, {
      ownerId: input.ownerId,
      id: inserted,
    });
    if (!transaction) {
      throw new Error("Committed transaction could not be read back");
    }
    return ok({ transaction, replayed: false });
  }
  const winner = await findReceipt(db, input);
  if (!winner) {
    throw new Error("Receipt vanished after a concurrent duplicate");
  }
  return replay(db, { input, receipt: winner, fingerprint });
}

interface ReplayOptions {
  input: Readonly<CreateTransactionInput>;
  receipt: { payloadFingerprint: string; transactionId: string };
  fingerprint: string;
}

async function replay(
  db: Database,
  { input, receipt, fingerprint }: Readonly<ReplayOptions>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  if (receipt.payloadFingerprint !== fingerprint) {
    return err({ code: "submission-conflict" });
  }
  // Read the receipt's record even if it was since deleted: a late retry
  // must confirm the original outcome, never recreate the record.
  const [row] = await detailQuery(db).where(
    and(
      eq(transactions.id, receipt.transactionId),
      eq(transactions.userId, input.ownerId),
    ),
  );
  if (!row) {
    throw new Error("Receipt points at a missing transaction");
  }
  return ok({ transaction: toDetail(row), replayed: true });
}

async function findReceipt(
  db: Database,
  input: Readonly<Pick<CreateTransactionInput, "ownerId" | "submissionKey">>,
) {
  const [receipt] = await db
    .select({
      payloadFingerprint: submissionReceipts.payloadFingerprint,
      transactionId: submissionReceipts.transactionId,
    })
    .from(submissionReceipts)
    .where(
      and(
        eq(submissionReceipts.userId, input.ownerId),
        eq(submissionReceipts.operation, CREATE_OPERATION),
        eq(submissionReceipts.key, input.submissionKey),
      ),
    );
  return receipt;
}

/** The fields every transaction carries, whether created or edited. */
type TransactionFields = Pick<
  CreateTransactionInput,
  | "ownerId"
  | "type"
  | "walletId"
  | "categoryId"
  | "destinationWalletId"
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
  if (input.type === "transfer") {
    if (input.currency !== "THB") {
      return { code: "invalid-currency" };
    }
    if (!input.destinationWalletId || input.categoryId !== null) {
      return { code: "invalid-transfer" };
    }
    if (input.walletId === input.destinationWalletId) {
      return { code: "same-wallet" };
    }
  } else if (input.destinationWalletId) {
    return { code: "invalid-transfer" };
  }
  const walletIds = walletIdsOf(input);
  // Stable lock order also protects validation against future wallet lifecycle writes.
  const ownedWallets = await tx
    .select({
      id: wallets.id,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
    })
    .from(wallets)
    .where(
      and(inArray(wallets.id, walletIds), eq(wallets.userId, input.ownerId)),
    )
    .orderBy(asc(wallets.id))
    .for("share");
  if (!ownedWallets.some((wallet) => wallet.id === input.walletId)) {
    return { code: "wallet-not-found" };
  }
  if (
    input.destinationWalletId &&
    !ownedWallets.some((wallet) => wallet.id === input.destinationWalletId)
  ) {
    return { code: "destination-wallet-not-found" };
  }
  for (const wallet of ownedWallets) {
    if (wallet.archivedAt && !input.retainedWalletIds?.includes(wallet.id)) {
      return { code: "wallet-archived", walletId: wallet.id };
    }
  }
  if (input.type !== "transfer") {
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
      );
    if (!category) {
      return { code: "category-not-found" };
    }
    if (category.kind !== input.type) {
      return { code: "category-kind-mismatch" };
    }
  }
  const today = todayIn({ timeZone: APP_TIME_ZONE });
  if (input.transactionDate > today) {
    return { code: "future-date", today };
  }
  for (const wallet of ownedWallets) {
    if (input.transactionDate < wallet.openingDate) {
      return { code: "before-opening", openingDate: wallet.openingDate };
    }
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

/** The canonical validated payload; key order is fixed so equal inputs hash alike. */
function fingerprintPayload(input: Readonly<CreateTransactionInput>): string {
  const canonical = JSON.stringify({
    amount: input.amount.toString(),
    categoryId: input.categoryId,
    note: input.note,
    transactionDate: input.transactionDate,
    type: input.type,
    walletId: input.walletId,
    ...(input.type === "transfer"
      ? {
          destinationWalletId: input.destinationWalletId,
          currency: input.currency,
        }
      : {}),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

const destinationWallets = alias(wallets, "destination_wallets");

const parentCategories = alias(categories, "parent_categories");

function detailQuery(db: Database) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      transactionDate: transactions.transactionDate,
      note: transactions.note,
      recordedAt: transactions.recordedAt,
      walletId: wallets.id,
      walletName: wallets.name,
      walletType: wallets.type,
      walletArchivedAt: wallets.archivedAt,
      destinationWalletId: destinationWallets.id,
      destinationWalletName: destinationWallets.name,
      destinationWalletType: destinationWallets.type,
      destinationWalletArchivedAt: destinationWallets.archivedAt,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIconId: categories.iconId,
      parentName: parentCategories.name,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .leftJoin(
      destinationWallets,
      eq(destinationWallets.id, transactions.destinationWalletId),
    )
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(parentCategories, eq(parentCategories.id, categories.parentId));
}

type DetailRow = Awaited<ReturnType<typeof detailQuery>>[number];

function toDetail(row: DetailRow): TransactionDetail {
  return {
    id: row.id,
    type: row.type,
    currency: "THB",
    amount: row.amount,
    transactionDate: row.transactionDate,
    note: row.note,
    recordedAt: row.recordedAt,
    wallet: {
      id: row.walletId,
      name: row.walletName,
      type: row.walletType,
      archived: Boolean(row.walletArchivedAt),
    },
    destinationWallet:
      row.destinationWalletId &&
      row.destinationWalletName &&
      row.destinationWalletType
        ? {
            id: row.destinationWalletId,
            name: row.destinationWalletName,
            type: row.destinationWalletType,
            archived: Boolean(row.destinationWalletArchivedAt),
          }
        : null,
    category:
      row.categoryId && row.categoryName && row.categoryIconId
        ? {
            id: row.categoryId,
            name: row.categoryName,
            iconId: row.categoryIconId,
            parentName: row.parentName,
          }
        : null,
  };
}

/** Current transactions, newest transaction date first; recording order only breaks ties. */
export async function listTransactions(
  db: Database,
  ownerId: string,
): Promise<readonly TransactionDetail[]> {
  const rows = await detailQuery(db)
    .where(
      and(eq(transactions.userId, ownerId), isNull(transactions.deletedAt)),
    )
    .orderBy(
      desc(transactions.transactionDate),
      desc(transactions.recordedAt),
      desc(transactions.id),
    );
  return rows.map(toDetail);
}

interface GetTransactionOptions {
  ownerId: string;
  id: string;
}

export async function getTransaction(
  db: Database,
  { ownerId, id }: Readonly<GetTransactionOptions>,
): Promise<TransactionDetail | undefined> {
  const [row] = await detailQuery(db).where(
    and(
      eq(transactions.id, id),
      eq(transactions.userId, ownerId),
      isNull(transactions.deletedAt),
    ),
  );
  return row ? toDetail(row) : undefined;
}

/** The wallet the owner recorded into most recently, if any. */
export async function lastUsedWalletId(
  db: Database,
  ownerId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ walletId: transactions.walletId })
    .from(transactions)
    .where(
      and(eq(transactions.userId, ownerId), isNull(transactions.deletedAt)),
    )
    .orderBy(desc(transactions.recordedAt), desc(transactions.id))
    .limit(1);
  return row?.walletId;
}

export interface UpdateTransactionInput {
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
  { code: "transaction-not-found" } | FieldRejection;

interface SnapshotInput {
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
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
      amount: input.amount.toString(),
      transactionDate: input.transactionDate,
      note: input.note,
    } satisfies TransactionSnapshot;
    rejection = await validateAgainstOwner(tx, {
      ...input,
      type: current.type,
      retainedWalletIds: walletIdsOf(current),
    });
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
  const transaction = await getTransaction(db, input);
  if (!transaction) {
    throw new Error("Edited transaction could not be read back");
  }
  return ok(transaction);
}

interface DeleteTransactionOptions {
  ownerId: string;
  id: string;
}

export interface DeleteTransactionError {
  code: "transaction-not-found";
}

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
  await db.transaction(async (tx) => {
    const current = await lockCurrentTransaction(tx, { ownerId, id });
    if (!current) {
      return;
    }
    found = true;
    if (current.deletedAt) {
      return;
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
  return found ? ok({ id }) : err({ code: "transaction-not-found" });
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
