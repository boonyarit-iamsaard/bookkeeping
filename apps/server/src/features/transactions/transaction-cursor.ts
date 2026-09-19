import { Buffer } from "node:buffer";
import type { TransactionListPosition } from "@bookkeeping/application/transactions";
import type { TransactionType } from "@bookkeeping/domain/transactions";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import * as z from "zod";

const CURSOR_VERSION = 1;
const CURSOR_RESOURCE = "transactions";
const CURSOR_ORDER = "transaction-date-recorded-at-id-desc";
const CURSOR_RECORDING_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export interface TransactionCursorFilters {
  from: string | null;
  to: string | null;
  walletId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
}

interface TransactionCursorInput {
  ownerId: string;
  filters: Readonly<TransactionCursorFilters>;
  position: Readonly<TransactionListPosition>;
}

interface TransactionCursorExpectation {
  ownerId: string;
  filters: Readonly<TransactionCursorFilters>;
}

const transactionCursorSchema = z.strictObject({
  version: z.literal(CURSOR_VERSION),
  resource: z.literal(CURSOR_RESOURCE),
  order: z.literal(CURSOR_ORDER),
  ownerId: z.uuid(),
  filters: z.strictObject({
    from: z.iso.date().nullable(),
    to: z.iso.date().nullable(),
    walletId: z.uuid().nullable(),
    categoryId: z.uuid().nullable(),
    type: z.enum(TRANSACTION_TYPES).nullable(),
  }),
  position: z.strictObject({
    transactionDate: z.iso.date(),
    recordedAt: z.string().regex(CURSOR_RECORDING_TIME_PATTERN),
    id: z.uuid(),
  }),
});

type TransactionCursorPayload = z.infer<typeof transactionCursorSchema>;

function sameFilters(
  left: Readonly<TransactionCursorFilters>,
  right: Readonly<TransactionCursorFilters>,
) {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.walletId === right.walletId &&
    left.categoryId === right.categoryId &&
    left.type === right.type
  );
}

export function encodeTransactionCursor(
  input: Readonly<TransactionCursorInput>,
): string {
  const payload: TransactionCursorPayload = {
    version: CURSOR_VERSION,
    resource: CURSOR_RESOURCE,
    order: CURSOR_ORDER,
    ownerId: input.ownerId,
    filters: { ...input.filters },
    position: { ...input.position },
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeTransactionCursor(
  cursor: string,
  expected: Readonly<TransactionCursorExpectation>,
): TransactionListPosition | null {
  try {
    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.length === 0 || decoded.toString("base64url") !== cursor) {
      return null;
    }
    const parsed: unknown = JSON.parse(decoded.toString("utf8"));
    const result = transactionCursorSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    if (
      result.data.ownerId !== expected.ownerId ||
      !sameFilters(result.data.filters, expected.filters)
    ) {
      return null;
    }
    return result.data.position;
  } catch {
    return null;
  }
}
