import { createHash } from "node:crypto";
import type { Database } from "@bookkeeping/database/connection";
import { creationReceipts } from "@bookkeeping/database/idempotency";
import type { Result } from "@bookkeeping/domain/result";
import { err, ok } from "@bookkeeping/domain/result";
import { and, eq, sql } from "drizzle-orm";

export interface ValidatedPayloadObject {
  readonly [key: string]: ValidatedPayload;
}

export type ValidatedPayload =
  | null
  | boolean
  | string
  | number
  | bigint
  | readonly ValidatedPayload[]
  | ValidatedPayloadObject;

export interface StoredCreationResultObject {
  readonly [key: string]: StoredCreationResult;
}

/** JSON-safe application data kept independently of transport DTOs. */
export type StoredCreationResult =
  | null
  | boolean
  | string
  | number
  | readonly StoredCreationResult[]
  | StoredCreationResultObject;

export interface CreationResultCodec<T> {
  encode: (value: Readonly<T>) => StoredCreationResult;
  decode: (value: unknown) => T;
}

export interface IdempotentCreationOutcome<T> {
  result: T;
  replayed: boolean;
}

export interface IdempotencyConflict {
  code: "idempotency-conflict";
}

interface IdempotentCreationOptions<T, E> {
  /** Always derived from the authenticated session. */
  ownerId: string;
  /** A stable application operation name, such as `wallets.create`. */
  operation: string;
  key: string;
  /** The complete payload after boundary and application normalization. */
  payload: ValidatedPayload;
  resultCodec: CreationResultCodec<T>;
  create: (db: Database) => Promise<Result<T, E>>;
}

/**
 * Commits a resource creation and its replayable application result together.
 * Calls sharing an owner, operation, and key serialize before any creation
 * work, while other scopes remain independent.
 */
export async function executeIdempotentCreation<T, E>(
  db: Database,
  options: Readonly<IdempotentCreationOptions<T, E>>,
): Promise<Result<IdempotentCreationOutcome<T>, E | IdempotencyConflict>> {
  const payloadFingerprint = fingerprintValidatedPayload(options.payload);
  return db.transaction(async (tx) => {
    await lockCreationScope(tx, options);
    const [receipt] = await tx
      .select({
        payloadFingerprint: creationReceipts.payloadFingerprint,
        result: creationReceipts.result,
      })
      .from(creationReceipts)
      .where(
        and(
          eq(creationReceipts.userId, options.ownerId),
          eq(creationReceipts.operation, options.operation),
          eq(creationReceipts.key, options.key),
        ),
      );
    if (receipt) {
      if (receipt.payloadFingerprint !== payloadFingerprint) {
        return err({ code: "idempotency-conflict" });
      }
      return ok({
        result: options.resultCodec.decode(receipt.result),
        replayed: true,
      });
    }

    await tx.execute(sql.raw("savepoint idempotent_creation"));
    const created = await options.create(tx);
    if (!created.ok) {
      await tx.execute(sql.raw("rollback to savepoint idempotent_creation"));
      await tx.execute(sql.raw("release savepoint idempotent_creation"));
      return created;
    }
    const storedResult = options.resultCodec.encode(created.value);
    await tx.insert(creationReceipts).values({
      userId: options.ownerId,
      operation: options.operation,
      key: options.key,
      payloadFingerprint,
      result: storedResult,
    });
    await tx.execute(sql.raw("release savepoint idempotent_creation"));
    return ok({ result: created.value, replayed: false });
  });
}

async function lockCreationScope(
  db: Database,
  options: Readonly<
    Pick<
      IdempotentCreationOptions<unknown, unknown>,
      "ownerId" | "operation" | "key"
    >
  >,
): Promise<void> {
  const scope = JSON.stringify([
    options.ownerId,
    options.operation,
    options.key,
  ]);
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${scope}, 0))`,
  );
}

/** A deterministic SHA-256 over the complete validated application payload. */
export function fingerprintValidatedPayload(payload: ValidatedPayload): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

function canonicalize(value: ValidatedPayload): string {
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
  if (isValidatedPayloadArray(value)) {
    return `["array",${value.map(canonicalize).join(",")}]`;
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

function isValidatedPayloadArray(
  value: ValidatedPayload,
): value is readonly ValidatedPayload[] {
  return Array.isArray(value);
}
