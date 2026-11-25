import { describe, expect, test } from "vitest";
import {
  carriesOwnCategory,
  carriesOwnTags,
  isTransactionListPage,
} from "./transaction.types";

describe("what a transaction carries of its own", () => {
  test("income and expense carry their own category and tags", () => {
    for (const type of ["income", "expense"] as const) {
      expect(carriesOwnCategory({ type })).toBe(true);
      expect(carriesOwnTags({ type })).toBe(true);
    }
  });

  test("a transfer carries neither, and a refund carries its expense's", () => {
    for (const type of ["transfer", "refund"] as const) {
      expect(carriesOwnCategory({ type })).toBe(false);
      expect(carriesOwnTags({ type })).toBe(false);
    }
  });
});

test("a list page is a safe whole number from 1", () => {
  expect([1, 2, Number.MAX_SAFE_INTEGER].map(isTransactionListPage)).toEqual([
    true,
    true,
    true,
  ]);
  expect(
    [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN].map(
      isTransactionListPage,
    ),
  ).toEqual([false, false, false, false, false]);
});
