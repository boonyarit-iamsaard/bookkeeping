import { Buffer } from "node:buffer";
import type {
  ListTransactionsOptions,
  TransactionListPosition,
} from "@bookkeeping/application/transactions";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import * as z from "zod";

const CURSOR_VERSION = 1;
const CURSOR_RESOURCE = "transactions";
const CURSOR_ORDER = "transaction-date-recorded-at-id-desc";
const CURSOR_RECORDING_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

interface TransactionCursorInput {
  /** The owner and active filters the page was listed with; the cursor is bound to them. */
  options: Readonly<ListTransactionsOptions>;
  position: Readonly<TransactionListPosition>;
}

const FILTER_KEYS = [
  "from",
  "to",
  "walletId",
  "categoryId",
  "type",
] as const satisfies readonly (keyof ListTransactionsOptions)[];

const transactionCursorSchema = z.strictObject({
  version: z.literal(CURSOR_VERSION),
  resource: z.literal(CURSOR_RESOURCE),
  order: z.literal(CURSOR_ORDER),
  ownerId: z.uuid(),
  // Absent filters stay absent: JSON drops undefined members.
  filters: z.strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
  }),
  position: z.strictObject({
    transactionDate: z.iso.date(),
    recordedAt: z.string().regex(CURSOR_RECORDING_TIME_PATTERN),
    id: z.uuid(),
  }),
});

type TransactionCursorPayload = z.infer<typeof transactionCursorSchema>;

type CursorFilters = TransactionCursorPayload["filters"];

function filtersOf(options: Readonly<ListTransactionsOptions>): CursorFilters {
  return {
    from: options.from,
    to: options.to,
    walletId: options.walletId,
    categoryId: options.categoryId,
    type: options.type,
  };
}

function sameFilters(
  left: Readonly<CursorFilters>,
  right: Readonly<CursorFilters>,
) {
  return FILTER_KEYS.every((key) => left[key] === right[key]);
}

export function encodeTransactionCursor(
  input: Readonly<TransactionCursorInput>,
): string {
  const payload: TransactionCursorPayload = {
    version: CURSOR_VERSION,
    resource: CURSOR_RESOURCE,
    order: CURSOR_ORDER,
    ownerId: input.options.ownerId,
    filters: filtersOf(input.options),
    position: { ...input.position },
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** The position a cursor names, or null unless it was issued for this owner's identical query. */
export function decodeTransactionCursor(
  cursor: string,
  expected: Readonly<ListTransactionsOptions>,
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
      !sameFilters(result.data.filters, filtersOf(expected))
    ) {
      return null;
    }
    return result.data.position;
  } catch {
    return null;
  }
}
