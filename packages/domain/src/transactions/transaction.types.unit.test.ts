import { describe, expect, test } from "vitest";
import { carriesOwnCategory, carriesOwnTags } from "./transaction.types";

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
