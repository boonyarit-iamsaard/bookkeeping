import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  APP_TIME_ZONE,
  parseCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  ExpenseRefunds,
  LinkedExpense,
  MonthlySummary,
  RefundSummary,
  TransactionChange,
  TransactionChangeAction,
  TransactionDetail,
  TransactionFilters,
  TransactionSnapshot,
  TransactionType,
} from "@bookkeeping/domain/transactions";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
  TRANSACTION_TYPES,
} from "@bookkeeping/domain/transactions";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as z from "zod";
import type {
  CreationResultCodec,
  IdempotencyConflict,
  StoredCreationResult,
  ValidatedPayload,
} from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";

export interface TransactionRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

const destinationWallets = alias(wallets, "destination_wallets");

const parentCategories = alias(categories, "parent_categories");

const refundedExpenses = alias(transactions, "refunded_expenses");

/** A text key that preserves PostgreSQL's microsecond recording precision. */
const recordingPosition = sql<string>`to_char(${transactions.recordedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function detailQuery(db: Database) {
  return (
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        note: transactions.note,
        recordedAt: transactions.recordedAt,
        recordingPosition,
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
        refundOfId: refundedExpenses.id,
        refundOfAmount: refundedExpenses.amount,
        refundOfTransactionDate: refundedExpenses.transactionDate,
      })
      .from(transactions)
      .innerJoin(wallets, eq(wallets.id, transactions.walletId))
      .leftJoin(
        destinationWallets,
        eq(destinationWallets.id, transactions.destinationWalletId),
      )
      .leftJoin(
        refundedExpenses,
        eq(refundedExpenses.id, transactions.refundOfTransactionId),
      )
      // A refund carries no category of its own: it reads its expense's
      // current one, so category changes and removal fallbacks follow at once.
      .leftJoin(
        categories,
        eq(
          categories.id,
          sql`coalesce(${transactions.categoryId}, ${refundedExpenses.categoryId})`,
        ),
      )
      .leftJoin(parentCategories, eq(parentCategories.id, categories.parentId))
  );
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
    refundOf:
      row.refundOfId && row.refundOfAmount && row.refundOfTransactionDate
        ? {
            id: row.refundOfId,
            amount: row.refundOfAmount,
            transactionDate: row.refundOfTransactionDate,
          }
        : null,
  };
}

/**
 * One owned current transaction with its wallet, destination, category, and
 * expense link, or `null` when the owner has none: a missing, deleted,
 * foreign, or malformed identifier all read as not found.
 */
export async function findTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<TransactionDetail | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [row] = await detailQuery(db).where(
    and(
      eq(transactions.id, id),
      eq(transactions.userId, ownerId),
      isNull(transactions.deletedAt),
    ),
  );
  return row ? toDetail(row) : null;
}

/**
 * The record an idempotent create retry reads back through its receipt, even
 * if it was since deleted: a late retry must confirm the original outcome,
 * never recreate the record. Not for normal views, which must not see
 * deleted records; absorbed by the create operation with its own ticket.
 */
export async function findReplayedTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<TransactionDetail | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [row] = await detailQuery(db).where(
    and(eq(transactions.id, id), eq(transactions.userId, ownerId)),
  );
  return row ? toDetail(row) : null;
}

export interface CreateTransactionInput {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId?: string | null;
  /** The owner's expense a refund returns money for; refunds only. */
  refundOfTransactionId?: string | null;
  /** Transfers must explicitly carry THB; other types may omit it. */
  currency?: "THB";
  /** Integer satang, always positive; the type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export interface CreateTransactionOutcome {
  transaction: TransactionDetail;
  /** True when an earlier request with the same key already created it. */
  replayed: boolean;
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
  | { code: "invalid-date" }
  | { code: "future-date"; today: CalendarDate }
  | { code: "before-opening"; openingDate: CalendarDate }
  | { code: "invalid-refund" }
  | { code: "expense-not-found" }
  | { code: "before-expense"; expenseDate: CalendarDate }
  | { code: "exceeds-refundable"; remaining: bigint }
  | IdempotencyConflict;

type TransactionValidationError = Exclude<
  CreateTransactionError,
  IdempotencyConflict
>;

/** Every financial field a create or edit validates against the owner's records. */
interface TransactionFields {
  ownerId: string;
  type: TransactionType;
  walletId: string;
  categoryId: string | null;
  destinationWalletId: string | null;
  refundOfTransactionId: string | null;
  currency?: "THB";
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
  /** Wallets an edit may keep even though they are archived: its own. */
  retainedWalletIds?: readonly string[];
  /** The refund being edited, whose own old amount does not count against it. */
  editingRefundId?: string;
}

interface OwnedWalletForTransaction {
  id: string;
  openingDate: CalendarDate;
  archivedAt: Date | null;
}

const TRANSACTION_CREATION_OPERATION = "transactions.create";

const storedTransactionWalletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(WALLET_TYPES),
  archived: z.boolean(),
});

const storedTransactionDetailSchema = z.object({
  id: z.uuid(),
  type: z.enum(TRANSACTION_TYPES),
  currency: z.literal("THB"),
  amount: z.string().regex(/^\d+$/),
  transactionDate: z.iso.date(),
  note: z.string(),
  recordedAt: z.iso.datetime(),
  wallet: storedTransactionWalletSchema,
  destinationWallet: storedTransactionWalletSchema.nullable(),
  category: z
    .object({
      id: z.uuid(),
      name: z.string(),
      iconId: z.string(),
      parentName: z.string().nullable(),
    })
    .nullable(),
  refundOf: z
    .object({
      id: z.uuid(),
      amount: z.string().regex(/^\d+$/),
      transactionDate: z.iso.date(),
    })
    .nullable(),
});

const transactionResultCodec: CreationResultCodec<TransactionDetail> = {
  encode(value): StoredCreationResult {
    return encodeTransactionDetail(value);
  },
  decode(value): TransactionDetail {
    const stored = storedTransactionDetailSchema.parse(value);
    return {
      id: stored.id,
      type: stored.type,
      currency: stored.currency,
      amount: BigInt(stored.amount),
      transactionDate: stored.transactionDate,
      note: stored.note,
      recordedAt: new Date(stored.recordedAt),
      wallet: stored.wallet,
      destinationWallet: stored.destinationWallet,
      category: stored.category,
      refundOf: stored.refundOf
        ? {
            id: stored.refundOf.id,
            amount: BigInt(stored.refundOf.amount),
            transactionDate: stored.refundOf.transactionDate,
          }
        : null,
    };
  },
};

function encodeTransactionDetail(
  value: Readonly<TransactionDetail>,
): StoredCreationResult {
  return {
    id: value.id,
    type: value.type,
    currency: value.currency,
    amount: value.amount.toString(),
    transactionDate: value.transactionDate,
    note: value.note,
    recordedAt: value.recordedAt.toISOString(),
    wallet: {
      id: value.wallet.id,
      name: value.wallet.name,
      type: value.wallet.type,
      archived: value.wallet.archived,
    },
    destinationWallet: value.destinationWallet
      ? {
          id: value.destinationWallet.id,
          name: value.destinationWallet.name,
          type: value.destinationWallet.type,
          archived: value.destinationWallet.archived,
        }
      : null,
    category: value.category
      ? {
          id: value.category.id,
          name: value.category.name,
          iconId: value.category.iconId,
          parentName: value.category.parentName,
        }
      : null,
    refundOf: value.refundOf
      ? {
          id: value.refundOf.id,
          amount: value.refundOf.amount.toString(),
          transactionDate: value.refundOf.transactionDate,
        }
      : null,
  };
}

/**
 * Creates one transaction and its durable result snapshot per idempotency key.
 * Validation failures happen before the key is touched, while ownership and
 * locking checks run in the same transaction as the financial insert.
 */
export async function createTransaction(
  db: Database,
  input: Readonly<CreateTransactionInput>,
): Promise<Result<CreateTransactionOutcome, CreateTransactionError>> {
  const command = normalizeTransactionInput(input);
  const invalid = validateTransactionValues(command);
  if (invalid) {
    return err(invalid);
  }

  const outcome = await executeIdempotentCreation<
    TransactionDetail,
    CreateTransactionError
  >(db, {
    ownerId: input.ownerId,
    operation: TRANSACTION_CREATION_OPERATION,
    key: input.idempotencyKey,
    payload: transactionCreationPayload(command),
    resultCodec: transactionResultCodec,
    create: (tx) => insertTransaction(tx, command),
  });
  if (!outcome.ok) {
    return err(outcome.error);
  }
  return ok({
    transaction: outcome.value.result,
    replayed: outcome.value.replayed,
  });
}

function normalizeTransactionInput(
  input: Readonly<CreateTransactionInput>,
): TransactionFields {
  const currency =
    input.type === "transfer"
      ? input.currency
      : input.type === "refund"
        ? undefined
        : "THB";
  return {
    ownerId: input.ownerId,
    type: input.type,
    walletId: input.walletId,
    categoryId: input.categoryId ?? null,
    destinationWalletId: input.destinationWalletId ?? null,
    refundOfTransactionId: input.refundOfTransactionId ?? null,
    currency,
    amount: input.amount,
    transactionDate: input.transactionDate,
    note: input.note,
  };
}

function transactionCreationPayload(
  input: Readonly<TransactionFields>,
): ValidatedPayload {
  return {
    type: input.type,
    walletId: input.walletId,
    categoryId: input.categoryId,
    destinationWalletId: input.destinationWalletId,
    refundOfTransactionId: input.refundOfTransactionId,
    currency: input.currency ?? null,
    amount: input.amount,
    transactionDate: input.transactionDate,
    note: input.note,
  };
}

function validateTransactionValues(
  input: Readonly<
    Pick<TransactionFields, "amount" | "note" | "transactionDate">
  >,
): TransactionValidationError | undefined {
  if (
    input.amount < MIN_TRANSACTION_AMOUNT ||
    input.amount > MAX_TRANSACTION_AMOUNT
  ) {
    return { code: "amount-out-of-range" };
  }
  if (input.note.length > MAX_NOTE_LENGTH) {
    return { code: "note-too-long" };
  }
  if (!parseCalendarDate(input.transactionDate).ok) {
    return { code: "invalid-date" };
  }
  return undefined;
}

async function insertTransaction(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<Result<TransactionDetail, TransactionValidationError>> {
  const rejection = await validateTransactionOwner(tx, input);
  if (rejection) {
    return err(rejection);
  }
  const [row] = await tx
    .insert(transactions)
    .values({
      userId: input.ownerId,
      type: input.type,
      walletId: input.walletId,
      categoryId: input.categoryId,
      destinationWalletId: input.destinationWalletId,
      refundOfTransactionId: input.refundOfTransactionId,
      currency: "THB",
      amount: input.amount,
      transactionDate: input.transactionDate,
      note: input.note,
    })
    .returning({ id: transactions.id });
  if (!row) {
    throw new Error("Transaction insert returned no row");
  }
  const [detailRow] = await detailQuery(tx).where(
    and(eq(transactions.id, row.id), eq(transactions.userId, input.ownerId)),
  );
  if (!detailRow) {
    throw new Error("Created transaction could not be read back");
  }
  return ok(toDetail(detailRow));
}

async function validateTransactionOwner(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<TransactionValidationError | undefined> {
  const shapeRejection =
    validateTransferShape(input) ?? validateRefundShape(input);
  if (shapeRejection) {
    return shapeRejection;
  }
  // The expense lock comes before wallet locks everywhere, so refunds,
  // corrections, and wallet archiving cannot wait on each other in a cycle.
  const expense = await lockRefundedExpense(tx, input);
  if (!expense.ok) {
    return expense.error;
  }
  const owned = await lockOwnedWallets(tx, input);
  if (!owned.ok) {
    return owned.error;
  }
  const categoryRejection = await validateTransactionCategory(tx, input);
  if (categoryRejection) {
    return categoryRejection;
  }
  const dateRejection = validateTransactionDate(
    input.transactionDate,
    owned.value,
  );
  if (dateRejection) {
    return dateRejection;
  }
  if (!expense.value) {
    return undefined;
  }
  return validateRefundAgainstExpense(tx, {
    input,
    expense: expense.value,
  });
}

/** A refund names its expense and no category; nothing else names an expense. */
function validateRefundShape(
  input: Readonly<TransactionFields>,
): TransactionValidationError | undefined {
  if (input.type !== "refund") {
    return input.refundOfTransactionId ? { code: "invalid-refund" } : undefined;
  }
  if (!input.refundOfTransactionId || input.categoryId !== null) {
    return { code: "invalid-refund" };
  }
  return undefined;
}

/** A transfer names two distinct wallets in THB and no category. */
function validateTransferShape(
  input: Readonly<TransactionFields>,
): TransactionValidationError | undefined {
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

async function lockRefundedExpense(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<Result<LinkedExpense | undefined, TransactionValidationError>> {
  if (input.type !== "refund" || !input.refundOfTransactionId) {
    return ok(undefined);
  }
  if (!isUuid(input.refundOfTransactionId)) {
    return err({ code: "expense-not-found" });
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
  return ok({
    id: expense.id,
    amount: expense.amount,
    transactionDate: expense.transactionDate,
  });
}

interface RefundValidationInput {
  input: Readonly<TransactionFields>;
  expense: Readonly<LinkedExpense>;
}

async function validateRefundAgainstExpense(
  tx: Database,
  { input, expense }: Readonly<RefundValidationInput>,
): Promise<TransactionValidationError | undefined> {
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

function walletIdsOf(
  input: Readonly<Pick<TransactionFields, "walletId" | "destinationWalletId">>,
): string[] {
  return input.destinationWalletId
    ? [input.walletId, input.destinationWalletId]
    : [input.walletId];
}

async function lockOwnedWallets(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<Result<OwnedWalletForTransaction[], TransactionValidationError>> {
  if (!isUuid(input.walletId)) {
    return err({ code: "wallet-not-found" });
  }
  if (input.destinationWalletId && !isUuid(input.destinationWalletId)) {
    return err({ code: "destination-wallet-not-found" });
  }
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

async function validateTransactionCategory(
  tx: Database,
  input: Readonly<TransactionFields>,
): Promise<TransactionValidationError | undefined> {
  if (input.type === "transfer" || input.type === "refund") {
    return undefined;
  }
  if (!input.categoryId || !isUuid(input.categoryId)) {
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

function validateTransactionDate(
  transactionDate: CalendarDate,
  ownedWallets: readonly OwnedWalletForTransaction[],
): TransactionValidationError | undefined {
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

/** The nondeleted refunds linked to an expense, oldest date first. */
async function currentRefundsOf(
  db: Database,
  expenseId: string,
): Promise<readonly RefundSummary[]> {
  const rows = await db
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

function sumOf(refunds: readonly RefundSummary[]): bigint {
  return refunds.reduce((total, refund) => total + refund.amount, 0n);
}

/**
 * The current refunds linked to one of the owner's expenses, oldest date
 * first, with what they add up to and what is left to refund. `null` unless
 * the id names one of the owner's current expenses: the allowance is not
 * defined for any other transaction.
 */
export async function findExpenseRefunds(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
): Promise<ExpenseRefunds | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [expense] = await db
    .select({ amount: transactions.amount, type: transactions.type })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
      ),
    );
  if (expense?.type !== "expense") {
    return null;
  }
  const refunds = await currentRefundsOf(db, id);
  const refundedTotal = sumOf(refunds);
  const remaining = expense.amount - refundedTotal;
  return {
    refunds,
    refundedTotal,
    remaining: remaining > 0n ? remaining : 0n,
  };
}

/** The wallet the owner recorded into most recently, if any. */
export async function findLastUsedWalletId(
  db: Database,
  ownerId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ walletId: transactions.walletId })
    .from(transactions)
    .where(
      and(eq(transactions.userId, ownerId), isNull(transactions.deletedAt)),
    )
    .orderBy(desc(transactions.recordedAt), desc(transactions.id))
    .limit(1);
  return row?.walletId ?? null;
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
  | { code: "transaction-not-found" }
  | TransactionValidationError
  | ExpenseGuardRejection;

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
  { ownerId, id }: Readonly<TransactionRef>,
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
 * Corrects a transaction in place. The type and its refund link are fixed;
 * the wallet, category, amount, date, and note are re-validated against the
 * owner's records inside the committing transaction, and an edit may keep
 * the archived wallets it already has. The recording time is kept and the
 * before/after snapshots are written with the change, so history and
 * balances can never disagree. An edit that changes nothing succeeds and
 * leaves no history.
 */
export async function updateTransaction(
  db: Database,
  input: Readonly<UpdateTransactionInput>,
): Promise<Result<TransactionDetail, UpdateTransactionError>> {
  const invalid = validateTransactionValues(input);
  if (invalid) {
    return err(invalid);
  }

  let rejection: UpdateTransactionError | undefined;
  let updated: TransactionDetail | undefined;
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
    rejection = await validateTransactionOwner(tx, {
      ownerId: input.ownerId,
      type: current.type,
      walletId: input.walletId,
      categoryId: input.categoryId,
      destinationWalletId: input.destinationWalletId ?? null,
      // The link is fixed with the type; the input cannot repoint a refund.
      refundOfTransactionId: current.refundOfTransactionId,
      currency: input.currency,
      amount: input.amount,
      transactionDate: input.transactionDate,
      note: input.note,
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
    if (!sameSnapshot(before, after)) {
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
    }
    const [detailRow] = await detailQuery(tx).where(
      and(
        eq(transactions.id, current.id),
        eq(transactions.userId, input.ownerId),
      ),
    );
    if (!detailRow) {
      throw new Error("Edited transaction could not be read back");
    }
    updated = toDetail(detailRow);
  });

  if (rejection) {
    return err(rejection);
  }
  if (!updated) {
    throw new Error("Edited transaction could not be read back");
  }
  return ok(updated);
}

interface ExpenseGuardCheck {
  current: Readonly<{ id: string; type: TransactionType }>;
  input: Readonly<Pick<UpdateTransactionInput, "amount" | "transactionDate">>;
}

/**
 * Soft-deletes a transaction: it leaves lists, detail, and every balance,
 * while the row and its receipts stay so a late create retry confirms the
 * original outcome instead of recreating it. The internal `delete` history
 * is written in the same transaction as the soft deletion. Repeating a
 * deletion is the same outcome, without new history. An expense keeps its
 * row while any of its refunds still count, and the blocking refunds are
 * returned so a client can remove them first.
 */
export type DeleteTransactionError =
  /** Also covers another owner's record and an unknown identifier. */
  | { code: "transaction-not-found" }
  /** An expense keeps its row while any of these refunds still count. */
  | { code: "refunds-exist"; refunds: readonly RefundSummary[] };

export async function deleteTransaction(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
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

/** The internal change history of one transaction, oldest first. Not for normal views. */
export async function listTransactionChanges(
  db: Database,
  { ownerId, id }: Readonly<TransactionRef>,
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

export interface ListTransactionsOptions extends TransactionFilters {
  /** Derived from the authenticated session at the edge. */
  ownerId: string;
}

export interface TransactionListPosition {
  transactionDate: TransactionDetail["transactionDate"];
  /** Canonical UTC text with six fractional-second digits. */
  recordedAt: string;
  id: string;
}

export interface ListTransactionPageOptions extends ListTransactionsOptions {
  limit: number;
  after?: TransactionListPosition;
}

export interface TransactionPage {
  items: readonly TransactionDetail[];
  nextPosition: TransactionListPosition | null;
}

interface TransactionWhereOptions {
  filters: Readonly<ListTransactionsOptions>;
  after?: TransactionListPosition;
}

const transactionListOrder = [
  desc(transactions.transactionDate),
  desc(transactions.recordedAt),
  desc(transactions.id),
] as const;

function transactionWhere({
  filters,
  after,
}: Readonly<TransactionWhereOptions>) {
  const sameDate = after
    ? eq(transactions.transactionDate, after.transactionDate)
    : undefined;
  const sameRecordingTime = after
    ? eq(recordingPosition, after.recordedAt)
    : undefined;

  return and(
    eq(transactions.userId, filters.ownerId),
    isNull(transactions.deletedAt),
    filters.from ? gte(transactions.transactionDate, filters.from) : undefined,
    filters.to ? lte(transactions.transactionDate, filters.to) : undefined,
    filters.type ? eq(transactions.type, filters.type) : undefined,
    filters.walletId
      ? and(
          eq(wallets.userId, filters.ownerId),
          or(
            eq(transactions.walletId, filters.walletId),
            eq(transactions.destinationWalletId, filters.walletId),
          ),
        )
      : undefined,
    filters.categoryId
      ? and(
          eq(categories.userId, filters.ownerId),
          or(
            eq(categories.id, filters.categoryId),
            eq(categories.parentId, filters.categoryId),
          ),
        )
      : undefined,
    after
      ? or(
          lt(transactions.transactionDate, after.transactionDate),
          and(sameDate, lt(recordingPosition, after.recordedAt)),
          and(sameDate, sameRecordingTime, lt(transactions.id, after.id)),
        )
      : undefined,
  );
}

function toTransactionListPosition(
  row: Readonly<
    Pick<DetailRow, "transactionDate" | "recordingPosition" | "id">
  >,
) {
  return {
    transactionDate: row.transactionDate,
    recordedAt: row.recordingPosition,
    id: row.id,
  };
}

/** Current financial history, newest transaction date first. */
export async function listTransactions(
  db: Database,
  filters: Readonly<ListTransactionsOptions>,
): Promise<readonly TransactionDetail[]> {
  const rows = await detailQuery(db)
    .where(transactionWhere({ filters }))
    .orderBy(...transactionListOrder);
  return rows.map(toDetail);
}

/** One keyset page of current financial history, newest first. */
export async function listTransactionPage(
  db: Database,
  options: Readonly<ListTransactionPageOptions>,
): Promise<TransactionPage> {
  const rows = await detailQuery(db)
    .where(transactionWhere({ filters: options, after: options.after }))
    .orderBy(...transactionListOrder)
    .limit(options.limit + 1);
  const items = rows.slice(0, options.limit);
  const last = items[items.length - 1];
  return {
    items: items.map(toDetail),
    nextPosition:
      rows.length > options.limit && last
        ? toTransactionListPosition(last)
        : null,
  };
}

interface MonthlySummaryOptions {
  ownerId: string;
  /** Validated YYYY-MM at the authenticated edge. Financial dates are Bangkok calendar dates. */
  month: string;
}

/** PostgreSQL numeric SUM returns decimal strings, preserving exact large totals. */
export async function getMonthlySummary(
  db: Database,
  { ownerId, month }: Readonly<MonthlySummaryOptions>,
): Promise<MonthlySummary> {
  const start = `${month}-01`;
  const monthEnd = new Date(`${start}T00:00:00Z`);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  const end = monthEnd.toISOString().slice(0, 10);
  const [row] = await db
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      grossExpenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      refunds: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'refund'), 0)`,
      transactionCount: sql<string>`count(*) filter (where ${transactions.type} != 'transfer')`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, ownerId),
        isNull(transactions.deletedAt),
        gte(transactions.transactionDate, start),
        lte(transactions.transactionDate, end),
      ),
    );
  if (!row) {
    throw new Error("Monthly aggregate returned no row");
  }
  const income = BigInt(row.income);
  const grossExpenses = BigInt(row.grossExpenses);
  const refunds = BigInt(row.refunds);
  const netExpenses = grossExpenses - refunds;
  return {
    month,
    income,
    grossExpenses,
    refunds,
    netExpenses,
    net: income - netExpenses,
    transactionCount: Number(row.transactionCount),
  };
}
