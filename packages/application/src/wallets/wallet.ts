import type { Database } from "@bookkeeping/database/connection";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  APP_TIME_ZONE,
  parseCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import { MAX_WHOLE_DIGITS } from "@bookkeeping/domain/money";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type { WalletSummary, WalletType } from "@bookkeeping/domain/wallets";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import type { SQL } from "drizzle-orm";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import * as z from "zod";
import type {
  CreationResultCodec,
  IdempotencyConflict,
} from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";

export interface ListWalletsOptions {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** End-of-day balances through this date; defaults to today in Bangkok. */
  asOf?: CalendarDate;
}

export interface FindWalletOptions extends ListWalletsOptions {
  id: string;
}

// PostgreSQL rejects a malformed uuid as a query fault; such an id simply
// names no wallet.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WalletSummaryQuery extends ListWalletsOptions {
  asOf: CalendarDate;
  /** Narrows beyond ownership; the owner condition is always applied. */
  filter?: SQL;
}

/**
 * Wallets in deterministic picker order with end-of-day balances: the opening
 * (once opened) plus income minus expenses through `asOf`. Recording time
 * plays no part; only transaction dates do.
 */
export async function listWallets(
  db: Database,
  {
    ownerId,
    asOf = todayIn({ timeZone: APP_TIME_ZONE }),
  }: Readonly<ListWalletsOptions>,
): Promise<readonly WalletSummary[]> {
  return selectWalletSummaries(db, { ownerId, asOf });
}

/**
 * One owned wallet with the balance the listing would show, or `null` when
 * the owner has no wallet with that id.
 */
export async function findWallet(
  db: Database,
  {
    ownerId,
    id,
    asOf = todayIn({ timeZone: APP_TIME_ZONE }),
  }: Readonly<FindWalletOptions>,
): Promise<WalletSummary | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }
  const [wallet] = await selectWalletSummaries(db, {
    ownerId,
    asOf,
    filter: eq(wallets.id, id),
  });
  return wallet ?? null;
}

async function selectWalletSummaries(
  db: Database,
  { ownerId, asOf, filter }: Readonly<WalletSummaryQuery>,
): Promise<WalletSummary[]> {
  const movement = sql<string>`coalesce(sum(case ${transactions.type}
    when 'income' then ${transactions.amount}
    when 'expense' then -${transactions.amount}
    when 'refund' then ${transactions.amount}
    when 'transfer' then case when ${transactions.walletId} = ${wallets.id} then -${transactions.amount} else ${transactions.amount} end
    else 0 end), 0)`;
  const rows = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      type: wallets.type,
      openingAmount: wallets.openingAmount,
      openingDate: wallets.openingDate,
      archivedAt: wallets.archivedAt,
      movement,
    })
    .from(wallets)
    .leftJoin(
      transactions,
      and(
        or(
          eq(transactions.walletId, wallets.id),
          eq(transactions.destinationWalletId, wallets.id),
        ),
        isNull(transactions.deletedAt),
        lte(transactions.transactionDate, asOf),
      ),
    )
    .where(and(eq(wallets.userId, ownerId), filter))
    .groupBy(wallets.id)
    .orderBy(asc(wallets.createdAt), asc(wallets.id));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    currency: "THB",
    openingAmount: row.openingAmount,
    openingDate: row.openingDate,
    archivedAt: row.archivedAt,
    balance:
      row.openingDate <= asOf ? row.openingAmount + BigInt(row.movement) : 0n,
  }));
}

/** A wallet as a client asks for it, before the application accepts it. */
export interface WalletCreationCommand {
  name: string;
  type: WalletType;
  /** Integer satang; zero and negative openings are valid. */
  openingAmount: bigint;
  openingDate: CalendarDate;
}

export type WalletCreationField = "name" | "openingAmount" | "openingDate";

export type WalletCreationIssueCode =
  | "empty"
  | "out-of-range"
  | "invalid"
  | "in-future";

export interface WalletCreationIssue {
  field: WalletCreationField;
  code: WalletCreationIssueCode;
}

export interface InvalidWalletCreation {
  code: "invalid-wallet";
  issues: readonly WalletCreationIssue[];
}

// The largest opening the domain lets an amount reach, in satang.
const MAX_OPENING_AMOUNT = 10n ** BigInt(MAX_WHOLE_DIGITS) * 100n - 1n;

/**
 * Accepts a wallet command independently of how it arrived: the name must
 * have visible characters, the opening must fit the stored range, and the
 * opening date must be a real calendar date no later than today in Bangkok.
 * Every issue is reported, so a client can correct them all at once.
 */
export function validateWalletCreation(
  command: Readonly<WalletCreationCommand>,
): Result<WalletCreationCommand, InvalidWalletCreation> {
  const issues: WalletCreationIssue[] = [];
  const name = command.name.trim();
  if (name === "") {
    issues.push({ field: "name", code: "empty" });
  }
  if (
    command.openingAmount > MAX_OPENING_AMOUNT ||
    command.openingAmount < -MAX_OPENING_AMOUNT
  ) {
    issues.push({ field: "openingAmount", code: "out-of-range" });
  }
  const openingDate = parseCalendarDate(command.openingDate);
  if (!openingDate.ok) {
    issues.push({ field: "openingDate", code: "invalid" });
  } else if (openingDate.value > todayIn({ timeZone: APP_TIME_ZONE })) {
    issues.push({ field: "openingDate", code: "in-future" });
  }
  if (issues.length > 0) {
    return err({ code: "invalid-wallet", issues });
  }
  return ok({ ...command, name });
}

export interface CreateWalletInput extends WalletCreationCommand {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
}

export interface CreateWalletOutcome {
  wallet: WalletSummary;
  /** True when an earlier request with the same key already created it. */
  replayed: boolean;
}

export type CreateWalletError = InvalidWalletCreation | IdempotencyConflict;

const WALLET_CREATION_OPERATION = "wallets.create";

// Integer satang travel as decimal strings so the receipt stays exact JSON.
const storedWalletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.enum(WALLET_TYPES),
  currency: z.literal("THB"),
  openingAmount: z.string().regex(/^-?\d+$/),
  openingDate: z.string(),
  // A wallet is never created archived, so the snapshot only ever holds null.
  archivedAt: z.null(),
  balance: z.string().regex(/^-?\d+$/),
});

const walletResultCodec: CreationResultCodec<WalletSummary> = {
  encode(wallet) {
    return {
      ...wallet,
      openingAmount: wallet.openingAmount.toString(),
      archivedAt: null,
      balance: wallet.balance.toString(),
    };
  },
  decode(value) {
    const stored = storedWalletSchema.parse(value);
    return {
      ...stored,
      openingAmount: BigInt(stored.openingAmount),
      balance: BigInt(stored.balance),
    };
  },
};

/**
 * Opens a wallet once per idempotency key. An invalid command is rejected
 * before the key is touched, so a corrected retry may reuse it; a retry with
 * the same accepted command replays the wallet as it was created.
 */
export async function createWallet(
  db: Database,
  input: Readonly<CreateWalletInput>,
): Promise<Result<CreateWalletOutcome, CreateWalletError>> {
  const validated = validateWalletCreation(input);
  if (!validated.ok) {
    return validated;
  }
  const command = validated.value;
  // The insert has no expected failure of its own; every rejection happens
  // during validation above.
  const outcome = await executeIdempotentCreation<WalletSummary, never>(db, {
    ownerId: input.ownerId,
    operation: WALLET_CREATION_OPERATION,
    key: input.idempotencyKey,
    // Spelled out rather than spread so a new command field cannot join the
    // fingerprint silently.
    payload: {
      name: command.name,
      type: command.type,
      openingAmount: command.openingAmount,
      openingDate: command.openingDate,
    },
    resultCodec: walletResultCodec,
    create: async (tx) =>
      ok(await insertWallet(tx, { ownerId: input.ownerId, ...command })),
  });
  if (!outcome.ok) {
    return err(outcome.error);
  }
  return ok({
    wallet: outcome.value.result,
    replayed: outcome.value.replayed,
  });
}

interface OwnedWalletCreation extends WalletCreationCommand {
  ownerId: string;
}

async function insertWallet(
  db: Database,
  command: Readonly<OwnedWalletCreation>,
): Promise<WalletSummary> {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: command.ownerId,
      name: command.name,
      type: command.type,
      currency: "THB",
      openingAmount: command.openingAmount,
      openingDate: command.openingDate,
    })
    .returning();
  if (!row) {
    throw new Error("Wallet insert returned no row");
  }
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: "THB",
    openingAmount: row.openingAmount,
    openingDate: row.openingDate,
    archivedAt: row.archivedAt,
    // Validation rejects future openings, so the opening is already in effect.
    balance: row.openingAmount,
  };
}
