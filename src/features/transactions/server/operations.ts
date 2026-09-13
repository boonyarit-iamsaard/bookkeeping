import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/core/database/database";
import { categories } from "@/core/database/schema/categories";
import type { TransactionType } from "@/core/database/schema/transaction-type";
import {
  submissionReceipts,
  transactions,
} from "@/core/database/schema/transactions";
import type { WalletType } from "@/core/database/schema/wallet-type";
import { wallets } from "@/core/database/schema/wallets";
import {
  MAX_NOTE_LENGTH,
  MAX_TRANSACTION_AMOUNT,
  MIN_TRANSACTION_AMOUNT,
} from "@/features/transactions/money-limits";
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
  categoryId: string;
  /** Integer satang, always positive; the type carries the sign. */
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
}

export type CreateTransactionError =
  | { code: "wallet-not-found" }
  | { code: "category-not-found" }
  | { code: "category-kind-mismatch" }
  | { code: "amount-out-of-range" }
  | { code: "note-too-long" }
  | { code: "future-date"; today: CalendarDate }
  | { code: "before-opening"; openingDate: CalendarDate }
  /** The same key was already used with a different payload. */
  | { code: "submission-conflict" };

export interface TransactionDetail {
  id: string;
  type: TransactionType;
  currency: "THB";
  amount: bigint;
  transactionDate: CalendarDate;
  note: string;
  /** The server instant of the original entry. */
  recordedAt: Date;
  wallet: { id: string; name: string; type: WalletType };
  category: {
    id: string;
    name: string;
    iconId: string;
    parentName: string | null;
  };
}

export interface CreateTransactionOutcome {
  transaction: TransactionDetail;
  /** True when the key had already committed and no new record was made. */
  replayed: boolean;
}

const REPLAY = Symbol("replay");

/**
 * Records one income or expense. Validation runs inside the committing
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
      const [wallet] = await tx
        .select({ openingDate: wallets.openingDate })
        .from(wallets)
        .where(
          and(
            eq(wallets.id, input.walletId),
            eq(wallets.userId, input.ownerId),
          ),
        );
      if (!wallet) {
        rejection = { code: "wallet-not-found" };
        return;
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
        rejection = { code: "category-not-found" };
        return;
      }
      if (category.kind !== input.type) {
        rejection = { code: "category-kind-mismatch" };
        return;
      }
      const today = todayIn({ timeZone: APP_TIME_ZONE });
      if (input.transactionDate > today) {
        rejection = { code: "future-date", today };
        return;
      }
      if (input.transactionDate < wallet.openingDate) {
        rejection = { code: "before-opening", openingDate: wallet.openingDate };
        return;
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          userId: input.ownerId,
          type: input.type,
          walletId: input.walletId,
          categoryId: input.categoryId,
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

function validateShape(
  input: Readonly<CreateTransactionInput>,
): CreateTransactionError | undefined {
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
  });
  return createHash("sha256").update(canonical).digest("hex");
}

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
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIconId: categories.iconId,
      parentName: parentCategories.name,
    })
    .from(transactions)
    .innerJoin(wallets, eq(wallets.id, transactions.walletId))
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
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
    wallet: { id: row.walletId, name: row.walletName, type: row.walletType },
    category: {
      id: row.categoryId,
      name: row.categoryName,
      iconId: row.categoryIconId,
      parentName: row.parentName,
    },
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
