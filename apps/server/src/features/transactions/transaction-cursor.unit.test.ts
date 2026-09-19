import type { TransactionListPosition } from "@bookkeeping/application/transactions";
import { describe, expect, test } from "vitest";
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from "./transaction-cursor.js";

const ownerId = "01999999-0000-7000-8000-000000000001";
const filters = {
  from: "2026-09-01",
  to: "2026-09-30",
  walletId: "01999999-0000-7000-8000-000000000002",
  categoryId: null,
  type: "expense" as const,
};
const position: TransactionListPosition = {
  transactionDate: "2026-09-05",
  recordedAt: "2026-09-05T03:07:08.123456Z",
  id: "01999999-0000-7000-8000-000000000003",
};

describe("transaction cursor", () => {
  test("round-trips an opaque position with its owner and filters", () => {
    const cursor = encodeTransactionCursor({ ownerId, filters, position });

    expect(cursor).not.toContain("2026-09-05");
    expect(decodeTransactionCursor(cursor, { ownerId, filters })).toEqual(
      position,
    );
  });

  test("rejects malformed, foreign, and differently filtered cursors", () => {
    const cursor = encodeTransactionCursor({ ownerId, filters, position });

    expect(decodeTransactionCursor("not-a-cursor", { ownerId, filters })).toBe(
      null,
    );
    expect(
      decodeTransactionCursor(cursor, {
        ownerId: "01999999-0000-7000-8000-000000000004",
        filters,
      }),
    ).toBeNull();
    expect(
      decodeTransactionCursor(cursor, {
        ownerId,
        filters: { ...filters, type: "income" },
      }),
    ).toBeNull();
  });
});
