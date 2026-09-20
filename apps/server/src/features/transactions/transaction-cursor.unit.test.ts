import type {
  ListTransactionsOptions,
  TransactionListPosition,
} from "@bookkeeping/application/transactions";
import { describe, expect, test } from "vitest";
import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from "./transaction-cursor.js";

const options: ListTransactionsOptions = {
  ownerId: "01999999-0000-7000-8000-000000000001",
  from: "2026-09-01",
  to: "2026-09-30",
  walletId: "01999999-0000-7000-8000-000000000002",
  type: "expense",
};
const position: TransactionListPosition = {
  transactionDate: "2026-09-05",
  recordedAt: "2026-09-05T03:07:08.123456Z",
  id: "01999999-0000-7000-8000-000000000003",
};

describe("transaction cursor", () => {
  test("round-trips an opaque position bound to the list's own options", () => {
    const cursor = encodeTransactionCursor({ options, position });

    expect(cursor).not.toContain("2026-09-05");
    expect(decodeTransactionCursor(cursor, options)).toEqual(position);
    // An absent filter and an explicitly undefined one are the same query.
    expect(
      decodeTransactionCursor(cursor, { ...options, categoryId: undefined }),
    ).toEqual(position);
  });

  test("rejects malformed, foreign, and differently filtered cursors", () => {
    const cursor = encodeTransactionCursor({ options, position });

    expect(decodeTransactionCursor("not-a-cursor", options)).toBeNull();
    expect(
      decodeTransactionCursor(cursor, {
        ...options,
        ownerId: "01999999-0000-7000-8000-000000000004",
      }),
    ).toBeNull();
    expect(
      decodeTransactionCursor(cursor, { ...options, type: "income" }),
    ).toBeNull();
    expect(
      decodeTransactionCursor(cursor, { ...options, to: undefined }),
    ).toBeNull();
  });
});
