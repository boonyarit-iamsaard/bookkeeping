import { createHash } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { creationReceipts } from "@bookkeeping/database/idempotency";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface StoredCreationResultObject {
  readonly [key: string]: StoredCreationResult;
}

/** The JSON a receipt holds: application data with bigint and Date values tagged. */
export type StoredCreationResult =
  | null
  | boolean
  | string
  | number
  | readonly StoredCreationResult[]
  | StoredCreationResultObject;

const BIGINT_TAG = "$bigint";
const DATE_TAG = "$date";

/**
 * Turns an application result into receipt JSON without knowing its shape:
 * bigint and Date become tagged objects, undefined members are dropped as
 * JSON drops them, and anything JSON cannot hold is refused.
 */
export function encodeStoredResult(value: unknown): StoredCreationResult {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Stored result numbers must be finite");
    }
    return value;
  }
  if (typeof value === "bigint") {
    return { [BIGINT_TAG]: value.toString() };
  }
  if (value instanceof Date) {
    return { [DATE_TAG]: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(encodeStoredResult);
  }
  if (isPlainObject(value)) {
    const encoded: Record<string, StoredCreationResult> = {};
    for (const [key, member] of Object.entries(value)) {
      if (member !== undefined) {
        encoded[key] = encodeStoredResult(member);
      }
    }
    return encoded;
  }
  throw new TypeError("Stored results hold JSON, bigint, and Date values only");
}

/** Reverses `encodeStoredResult`; the receipt was written by this module, so its shape is trusted. */
export function decodeStoredResult<T>(stored: unknown): T {
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: a receipt only has to survive its replay window, so it holds what encodeStoredResult wrote for T unless a deploy changed T inside that window; such a shape change may make a straddling replay conflict or fail, but never creates twice. No runtime schema exists for an arbitrary T.
  return decodeStored(stored) as T;
}

function decodeStored(stored: unknown): unknown {
  if (Array.isArray(stored)) {
    return stored.map(decodeStored);
  }
  if (!isPlainObject(stored)) {
    return stored;
  }
  const tagged = Object.entries(stored);
  if (tagged.length === 1 && tagged[0]) {
    const [tag, raw] = tagged[0];
    if (tag === BIGINT_TAG && typeof raw === "string") {
      return BigInt(raw);
    }
    if (tag === DATE_TAG && typeof raw === "string") {
      return new Date(raw);
    }
  }
  const decoded: Record<string, unknown> = {};
  for (const [key, member] of tagged) {
    decoded[key] = decodeStored(member);
  }
  return decoded;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export interface IdempotencyConflict {
  code: "idempotency-conflict";
}

/** How long a receipt replays, measured from its `created_at`. */
export const CREATION_REPLAY_WINDOW_HOURS = 24;

/** What every creator input carries besides the command itself. */
export interface IdempotentCreationRequest {
  /** Always derived from the authenticated session. */
  ownerId: string;
  /** Client-generated; one key names one logical creation for this owner. */
  idempotencyKey: string;
}

/**
 * The creator `defineIdempotentCreation` returns. A module declares its
 * exported creator with this type, so the contract is authored while the
 * definition's inferred return must still conform to it.
 */
export type IdempotentCreator<
  Input extends IdempotentCreationRequest,
  Value,
  Rejection,
> = (
  db: Database,
  input: Readonly<Input>,
) => Promise<Result<Value, Rejection | IdempotencyConflict>>;

export interface IdempotentCreationDefinition<
  Input extends IdempotentCreationRequest,
  Command extends object,
  Created,
  PrepareRejection,
  InsertRejection,
> {
  /** A stable application operation name, such as `wallets.create`. */
  operation: string;
  /**
   * Normalizes the input into a closed command, with no owner id or key, and
   * may reject it. It runs before any lock, so a rejection leaves the key
   * unused. The whole prepared command is fingerprinted.
   */
  prepare: (input: Readonly<Input>) => Result<Command, PrepareRejection>;
  /**
   * Writes the resource inside the creation's transaction. A rejection rolls
   * its writes back and leaves the key unused. The created value is stored as
   * the replayable receipt; bigint and Date survive the round trip.
   */
  insert: (
    tx: Database,
    creation: Readonly<{ ownerId: string; command: Command }>,
  ) => Promise<Result<Created, InsertRejection>>;
}

/**
 * Defines a resource creation that happens once per idempotency key and
 * returns its creator. The module owns the whole protocol: it prepares and
 * fingerprints the command, serializes calls sharing an owner, operation, and
 * key before any creation work (other scopes stay independent), then replays
 * the stored value, answers a conflict for a changed command, or creates and
 * stores the receipt in the same transaction.
 *
 * A receipt replays for `CREATION_REPLAY_WINDOW_HOURS`, which covers a client
 * retrying a lost response; after that the key names a new creation. Each
 * creation deletes the owner's expired receipts, comparing against the
 * database's `now()`. A receipt only has to survive its window, so a change
 * to an operation's command or result shape may make a request in flight
 * across a deploy conflict, but never creates twice. No compatibility code for
 * older receipts is kept.
 */
export function defineIdempotentCreation<
  Input extends IdempotentCreationRequest,
  Command extends object,
  Created,
  PrepareRejection,
  InsertRejection,
>(
  definition: Readonly<
    IdempotentCreationDefinition<
      Input,
      Command,
      Created,
      PrepareRejection,
      InsertRejection
    >
  >,
): IdempotentCreator<Input, Created, PrepareRejection | InsertRejection> {
  const { operation } = definition;
  return async (db, input) => {
    const prepared = definition.prepare(input);
    if (!prepared.ok) {
      return prepared;
    }
    const command = prepared.value;
    const { ownerId, idempotencyKey: key } = input;
    const payloadFingerprint = fingerprintValidatedPayload(command);
    return db.transaction(async (tx) => {
      await lockCreationScope(tx, { ownerId, operation, key });
      await purgeExpiredReceipts(tx, { ownerId, operation, key });
      const [receipt] = await tx
        .select({
          payloadFingerprint: creationReceipts.payloadFingerprint,
          result: creationReceipts.result,
        })
        .from(creationReceipts)
        .where(
          and(
            eq(creationReceipts.userId, ownerId),
            eq(creationReceipts.operation, operation),
            eq(creationReceipts.key, key),
          ),
        );
      if (receipt) {
        if (receipt.payloadFingerprint !== payloadFingerprint) {
          return err({ code: "idempotency-conflict" });
        }
        return ok(decodeStoredResult<Created>(receipt.result));
      }

      await tx.execute(sql.raw("savepoint idempotent_creation"));
      const created = await definition.insert(tx, { ownerId, command });
      if (!created.ok) {
        await tx.execute(sql.raw("rollback to savepoint idempotent_creation"));
        await tx.execute(sql.raw("release savepoint idempotent_creation"));
        return created;
      }
      await tx.insert(creationReceipts).values({
        userId: ownerId,
        operation,
        key,
        payloadFingerprint,
        result: encodeStoredResult(created.value),
      });
      await tx.execute(sql.raw("release savepoint idempotent_creation"));
      return created;
    });
  };
}

/** One receipt's identity: the creation scope a lock and a purge both address. */
interface ReceiptScope {
  ownerId: string;
  operation: string;
  key: string;
}

async function lockCreationScope(
  db: Database,
  { ownerId, operation, key }: Readonly<ReceiptScope>,
): Promise<void> {
  const scope = JSON.stringify([ownerId, operation, key]);
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${scope}, 0))`,
  );
}

const receiptIsExpired = sql`${creationReceipts.createdAt} < now() - make_interval(hours => ${CREATION_REPLAY_WINDOW_HOURS})`;

/**
 * Deletes the owner's receipts past their window, so an expired key counts as
 * absent. This key's own expired receipt goes first and is awaited, since the
 * creation needs it gone. The owner-wide sweep that follows runs under a
 * per-key lock, so it takes only rows nobody else holds: a concurrent
 * creation under another key sweeps the rest, and no two wait on each
 * other's rows.
 */
async function purgeExpiredReceipts(
  db: Database,
  { ownerId, operation, key }: Readonly<ReceiptScope>,
): Promise<void> {
  await db
    .delete(creationReceipts)
    .where(
      and(
        eq(creationReceipts.userId, ownerId),
        eq(creationReceipts.operation, operation),
        eq(creationReceipts.key, key),
        receiptIsExpired,
      ),
    );
  const unclaimed = db
    .select({ id: creationReceipts.id })
    .from(creationReceipts)
    .where(and(eq(creationReceipts.userId, ownerId), receiptIsExpired))
    .for("update", { skipLocked: true });
  await db
    .delete(creationReceipts)
    .where(inArray(creationReceipts.id, unclaimed));
}

/**
 * A deterministic SHA-256 over a complete prepared command: JSON scalars,
 * bigint, arrays, and plain objects. Anything else is refused.
 */
export function fingerprintValidatedPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null) {
    return '["null"]';
  }
  if (typeof value === "boolean") {
    return JSON.stringify(["boolean", value]);
  }
  if (typeof value === "string") {
    return JSON.stringify(["string", value]);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Validated payload numbers must be finite");
    }
    return JSON.stringify(["number", Object.is(value, -0) ? "-0" : value]);
  }
  if (typeof value === "bigint") {
    return JSON.stringify(["bigint", value.toString()]);
  }
  if (Array.isArray(value)) {
    return `["array",${value.map(canonicalize).join(",")}]`;
  }
  if (!isPlainObject(value)) {
    throw new TypeError("Validated payloads hold JSON and bigint values only");
  }
  const entries = Object.keys(value)
    .sort((a, b) => {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    })
    .map((key) => JSON.stringify([key, canonicalize(value[key])]));
  return `["object",${entries.join(",")}]`;
}
