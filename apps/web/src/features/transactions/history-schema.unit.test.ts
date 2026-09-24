import { describe, expect, test } from "vitest";
import {
  hasHistoryFilters,
  historyFilters,
  historySearchSchema,
  parseHistoryFilters,
  transactionFiltersSchema,
} from "./history-schema";

const WALLET_ID = "00000000-0000-4000-8000-000000000001";

describe("history search", () => {
  test("keeps text values and drops empty controls", () => {
    expect(
      historySearchSchema.parse({
        from: "2026-09-01",
        to: "",
        walletId: WALLET_ID,
        categoryId: undefined,
        cursor: "eyJ2IjoxfQ",
        created: "",
        unrelated: "x",
      }),
    ).toEqual({
      from: "2026-09-01",
      walletId: WALLET_ID,
      cursor: "eyJ2IjoxfQ",
    });
  });

  test("keeps the text of a value the router read as a number", () => {
    expect(historySearchSchema.parse({ type: 7 })).toEqual({ type: "7" });
    expect(transactionFiltersSchema.safeParse({ type: "7" }).success).toBe(
      false,
    );
  });

  test("reads the deletion flag as the number the address carries", () => {
    expect(historySearchSchema.parse({ deleted: 1 })).toEqual({ deleted: 1 });
    expect(historySearchSchema.parse({ deleted: "1" })).toEqual({
      deleted: 1,
    });
    expect(historySearchSchema.parse({ deleted: "yes" })).toEqual({});
  });

  test("a repeated parameter is not a filter value", () => {
    expect(historySearchSchema.parse({ from: ["2026-09-01"] })).toEqual({});
  });
});

describe("transaction filters", () => {
  test("accepts dates in order, uuids, and a known type", () => {
    const parsed = transactionFiltersSchema.safeParse({
      from: "2026-09-01",
      to: "2026-09-30",
      walletId: WALLET_ID,
      type: "expense",
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects a From date after the To date", () => {
    expect(
      transactionFiltersSchema.safeParse({
        from: "2026-09-03",
        to: "2026-09-01",
      }).success,
    ).toBe(false);
  });

  test("rejects year zero and impossible dates", () => {
    expect(
      transactionFiltersSchema.safeParse({ from: "0000-01-01" }).success,
    ).toBe(false);
    expect(
      transactionFiltersSchema.safeParse({ to: "2026-02-30" }).success,
    ).toBe(false);
  });

  test("rejects an unknown type and a malformed id", () => {
    expect(transactionFiltersSchema.safeParse({ type: "loan" }).success).toBe(
      false,
    );
    expect(
      transactionFiltersSchema.safeParse({ categoryId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("history filters", () => {
  test("separates the filters from the page cursor and the saved id", () => {
    expect(
      historyFilters({
        from: "2026-09-01",
        type: "income",
        cursor: "eyJ2IjoxfQ",
        created: "abc",
      }),
    ).toEqual({ from: "2026-09-01", type: "income" });
  });

  test("a cursor alone is not a filter", () => {
    expect(historyFilters({ cursor: "eyJ2IjoxfQ" })).toEqual({});
    expect(hasHistoryFilters({ cursor: "eyJ2IjoxfQ", created: "abc" })).toBe(
      false,
    );
    expect(hasHistoryFilters({ type: "income" })).toBe(true);
  });
});

describe("parsed history filters", () => {
  test("valid filters parse with no errors", () => {
    expect(
      parseHistoryFilters({ from: "2026-09-01", to: "2026-09-30" }),
    ).toEqual({ ok: true, filters: { from: "2026-09-01", to: "2026-09-30" } });
  });

  test("names each malformed field rather than the date order", () => {
    expect(
      parseHistoryFilters({ from: "bogus", walletId: "gone", type: "7" }),
    ).toEqual({
      ok: false,
      errors: [
        "Choose a valid From date.",
        "Choose a valid wallet.",
        "Choose a valid type.",
      ],
    });
  });

  test("a reversed range names the date order", () => {
    expect(
      parseHistoryFilters({ from: "2026-09-03", to: "2026-09-01" }),
    ).toEqual({
      ok: false,
      errors: ["From date must be on or before To date."],
    });
  });

  test("ignores the page cursor and the saved id", () => {
    expect(parseHistoryFilters({ cursor: "x", created: "y" })).toEqual({
      ok: true,
      filters: {},
    });
  });
});
