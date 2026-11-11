import type { Database } from "@bookkeeping/database/connection";
import {
  transactionChanges,
  transactions,
} from "@bookkeeping/database/transactions";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import {
  APP_TIME_ZONE,
  parseCalendarDate,
  todayIn,
} from "@bookkeeping/domain/dates";
import { MAX_WHOLE_DIGITS } from "@bookkeeping/domain/money";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import type {
  TotalBalanceSplit,
  WalletSummary,
  WalletType,
} from "@bookkeeping/domain/wallets";
import { and, eq, lt, or, sql } from "drizzle-orm";
import type { IdempotencyConflict } from "../idempotency/idempotency";
import { executeIdempotentCreation } from "../idempotency/idempotency";
import { isUuid } from "../shared/identifier";
import type { NotFound } from "../shared/not-found";
import { notFound } from "../shared/not-found";
import type { Rejected } from "../shared/rejection";
import { rejected } from "../shared/rejection";
import {
  selectWalletSummaries,
  summarizeWalletBalance,
} from "./wallet-balance";
import {
  loadWalletForUpdate,
  readWalletSummaryAfterChange,
  recordWalletChange,
  updateWallet,
} from "./wallet-change";

export interface ListWalletsOptions {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  /** End-of-day balances through this date; defaults to today in Bangkok. */
  asOf?: CalendarDate;
}

/** A wallet addressed by its owner and id. */
export interface WalletRef {
  /** Always the session user; never a client-supplied identifier. */
  ownerId: string;
  id: string;
}

export interface FindWalletOptions extends WalletRef {
  /** End-of-day balances through this date; defaults to today in Bangkok. */
  asOf?: CalendarDate;
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

/** The listed Wallets and their Total balance split into Spendable and Set aside. */
export interface WalletsWithBalance {
  wallets: readonly WalletSummary[];
  balance: TotalBalanceSplit;
}

/** `listWallets` with the balance split authored over the same Wallets. */
export async function listWalletsWithBalance(
  db: Database,
  options: Readonly<ListWalletsOptions>,
): Promise<WalletsWithBalance> {
  const listed = await listWallets(db, options);
  return { wallets: listed, balance: summarizeWalletBalance(listed) };
}

/**
 * One owned wallet with the balance the listing would show, or `null` when
 * the owner has no wallet with that id or it has not opened by `asOf`.
 */
export async function findWallet(
  db: Database,
  {
    ownerId,
    id,
    asOf = todayIn({ timeZone: APP_TIME_ZONE }),
  }: Readonly<FindWalletOptions>,
): Promise<WalletSummary | null> {
  if (!isUuid(id)) {
    return null;
  }
  const [wallet] = await selectWalletSummaries(db, {
    ownerId,
    asOf,
    filter: eq(wallets.id, id),
  });
  return wallet ?? null;
}

/** The opening balance: what a wallet held at the start of its history. */
export interface WalletOpening {
  /** Integer satang; zero and negative openings are valid. */
  openingAmount: bigint;
  openingDate: CalendarDate;
}

/** The inputs an opening carries, which a wallet creation and an opening replacement share. */
export type WalletOpeningField = "openingAmount" | "openingDate";

/** The inputs a wallet command can refuse: the creation adds the name to the opening's two. */
export type WalletField = "name" | WalletOpeningField;

/** Every rule rejection a wallet command reports; each names the input it refuses. */
export type WalletRejection =
  | { code: "empty"; field: "name" }
  | { code: "out-of-range"; field: "openingAmount" }
  | { code: "invalid"; field: "openingDate" }
  | { code: "in-future"; field: "openingDate" }
  /**
   * A movement, deleted ones included, is dated before the proposed opening.
   * Choosing an earlier date is the correction, so it names the date.
   */
  | { code: "movement-before-opening"; field: "openingDate" };

/** The rejections an opening can carry: everything but the name, which an opening lacks. */
export type WalletOpeningRejection = Exclude<
  WalletRejection,
  { field: "name" }
>;

/** The refused inputs of a wallet command, in the shared envelope. */
export type WalletRejected = Rejected<WalletRejection>;

/** The refused inputs of an opening, in the shared envelope. */
export type WalletOpeningRejected = Rejected<WalletOpeningRejection>;

// The largest opening the domain lets an amount reach, in satang.
const MAX_OPENING_AMOUNT = 10n ** BigInt(MAX_WHOLE_DIGITS) * 100n - 1n;

/**
 * Accepts an opening independently of how it arrived: the amount must fit
 * the stored range and the date must be a real calendar date no later than
 * today in Bangkok. Every rejection is reported, so a client can correct
 * them all at once.
 */
export function validateWalletOpening(
  opening: Readonly<WalletOpening>,
): Result<WalletOpening, WalletOpeningRejected> {
  const rejections = collectOpeningRejections(opening);
  const [first, ...rest] = rejections;
  if (first) {
    return err(rejected(first, ...rest));
  }
  return ok({
    openingAmount: opening.openingAmount,
    openingDate: opening.openingDate,
  });
}

function collectOpeningRejections(
  opening: Readonly<WalletOpening>,
): WalletOpeningRejection[] {
  const rejections: WalletOpeningRejection[] = [];
  if (
    opening.openingAmount > MAX_OPENING_AMOUNT ||
    opening.openingAmount < -MAX_OPENING_AMOUNT
  ) {
    rejections.push({ code: "out-of-range", field: "openingAmount" });
  }
  const openingDate = parseCalendarDate(opening.openingDate);
  if (!openingDate.ok) {
    rejections.push({ code: "invalid", field: "openingDate" });
  } else if (openingDate.value > todayIn({ timeZone: APP_TIME_ZONE })) {
    rejections.push({ code: "in-future", field: "openingDate" });
  }
  return rejections;
}

/** A wallet as a client asks for it, before the application accepts it. */
export interface WalletCreationCommand extends WalletOpening {
  name: string;
  type: WalletType;
  savings: boolean;
}

/**
 * Accepts a wallet command: the name must have visible characters and the
 * opening must satisfy `validateWalletOpening`. Every rejection is
 * reported, so a client can correct them all at once.
 */
export function validateWalletCreation(
  command: Readonly<WalletCreationCommand>,
): Result<WalletCreationCommand, WalletRejected> {
  const name = command.name.trim();
  const rejections: WalletRejection[] = [];
  if (name === "") {
    rejections.push({ code: "empty", field: "name" });
  }
  rejections.push(...collectOpeningRejections(command));
  const [first, ...rest] = rejections;
  if (first) {
    return err(rejected(first, ...rest));
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

export type CreateWalletError = WalletRejected | IdempotencyConflict;

const WALLET_CREATION_OPERATION = "wallets.create";

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
      savings: command.savings,
      openingAmount: command.openingAmount,
      openingDate: command.openingDate,
    },
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
      savings: command.savings,
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
    savings: row.savings,
    // Validation rejects future openings, so the opening is already in effect.
    balance: row.openingAmount,
  };
}

export interface ReplaceWalletOpeningInput extends WalletRef, WalletOpening {}

export type ReplaceWalletOpeningError = WalletOpeningRejected | NotFound;

/**
 * Replaces the opening balance as one value: amount and date change together
 * or not at all. An opening that predates no movement, deleted ones included,
 * is applied atomically with its change-history row under an exclusive
 * wallet lock, which serializes it with transaction share locks. Replacing
 * an opening with itself is a no-op that records nothing. Ownership is
 * checked with the lock, so an unowned, unknown, or malformed id is not
 * found alike.
 */
export async function replaceWalletOpening(
  db: Database,
  input: Readonly<ReplaceWalletOpeningInput>,
): Promise<Result<WalletSummary, ReplaceWalletOpeningError>> {
  const validated = validateWalletOpening(input);
  if (!validated.ok) {
    return validated;
  }
  const opening = validated.value;
  if (!isUuid(input.id)) {
    return err(notFound());
  }
  return db.transaction(async (tx) => {
    const current = await loadWalletForUpdate(tx, input);
    if (!current) {
      return err(notFound());
    }
    // Deleted movements are retained history; an opening cannot exclude them.
    const [movement] = await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          or(
            eq(transactions.walletId, input.id),
            eq(transactions.destinationWalletId, input.id),
          ),
          lt(transactions.transactionDate, opening.openingDate),
        ),
      )
      .limit(1);
    if (movement) {
      return err(
        rejected({ code: "movement-before-opening", field: "openingDate" }),
      );
    }
    if (
      current.openingAmount !== opening.openingAmount ||
      current.openingDate !== opening.openingDate
    ) {
      const updated = await updateWallet(tx, { id: input.id, set: opening });
      await recordWalletChange(tx, {
        ref: input,
        action: "opening",
        before: current,
        after: updated,
      });
    }
    return ok(await readWalletSummaryAfterChange(tx, input));
  });
}

export interface WalletHistoryRemains {
  code: "history-remains";
}

export type DeleteWalletError = NotFound | WalletHistoryRemains;

/**
 * Permanently removes an owned wallet only when neither its current records
 * nor any retained wallet or transaction history still refers to it. The
 * wallet lock serializes deletion with concurrent state changes.
 */
export async function deleteWallet(
  db: Database,
  input: Readonly<WalletRef>,
): Promise<Result<{ id: string }, DeleteWalletError>> {
  if (!isUuid(input.id)) {
    return err(notFound());
  }
  return db.transaction(async (tx) => {
    const current = await loadWalletForUpdate(tx, input);
    if (!current) {
      return err(notFound());
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
      return err({ code: "history-remains" });
    }
    await tx.delete(wallets).where(eq(wallets.id, input.id));
    return ok({ id: input.id });
  });
}
