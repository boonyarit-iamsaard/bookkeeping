import { describe, expect, test } from "vitest";
import {
  dailyReportQuerySchema,
  monthlyReportQuerySchema,
  monthlyReportResponseSchema,
} from "./report.routes.js";

describe("monthlyReportQuerySchema", () => {
  test("accepts a real month of any supported year", () => {
    for (const month of ["2026-09", "2026-12", "0001-01", "9999-12"]) {
      expect(monthlyReportQuerySchema.safeParse({ month }).success).toBe(true);
    }
  });

  test("rejects malformed, impossible, and unknown fields", () => {
    const rejects = (query: unknown) =>
      expect(monthlyReportQuerySchema.safeParse(query).success).toBe(false);
    rejects({ month: "2026-13" });
    rejects({ month: "2026-00" });
    rejects({ month: "2026-1" });
    rejects({ month: "26-09" });
    rejects({ month: "2026-09-01" });
    rejects({ month: "" });
    rejects({ month: "0000-01" });
    rejects({});
    rejects({ month: "2026-09", from: "2026-09-01" });
  });

  test("passes the month through untouched", () => {
    expect(monthlyReportQuerySchema.parse({ month: "2026-09" })).toEqual({
      month: "2026-09",
    });
  });
});

describe("dailyReportQuerySchema", () => {
  test("accepts a real calendar date and passes it through", () => {
    expect(dailyReportQuerySchema.parse({ date: "2026-09-30" })).toEqual({
      date: "2026-09-30",
    });
    expect(
      dailyReportQuerySchema.safeParse({ date: "2028-02-29" }).success,
    ).toBe(true);
  });

  test("rejects a missing, malformed or impossible date and unknown fields", () => {
    const rejects = (query: unknown) =>
      expect(dailyReportQuerySchema.safeParse(query).success).toBe(false);
    rejects({});
    rejects({ date: "" });
    rejects({ date: "2026-09" });
    rejects({ date: "2026-9-1" });
    rejects({ date: "26-09-01" });
    rejects({ date: "2026-02-30" });
    rejects({ date: "2026-13-01" });
    rejects({ date: "2026-00-10" });
    rejects({ date: "0000-01-01" });
    rejects({ date: "2026-09-01", month: "2026-09" });
  });
});

describe("monthlyReportResponseSchema", () => {
  test("accepts canonical money objects for every amount", () => {
    expect(
      monthlyReportResponseSchema.safeParse({
        month: "2026-09",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.50", currency: "THB" },
        refunds: { value: "100.25", currency: "THB" },
        netExpenses: { value: "400.25", currency: "THB" },
        net: { value: "599.75", currency: "THB" },
        transactionCount: 3,
      }).success,
    ).toBe(true);
  });

  test("accepts negative exact aggregates and a zero transaction count", () => {
    const parsed = monthlyReportResponseSchema.safeParse({
      month: "2026-10",
      income: { value: "0.00", currency: "THB" },
      grossExpenses: { value: "0.00", currency: "THB" },
      refunds: { value: "50.00", currency: "THB" },
      netExpenses: { value: "-50.00", currency: "THB" },
      net: { value: "50.00", currency: "THB" },
      transactionCount: 0,
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects presentation-only amounts and incomplete bodies", () => {
    expect(
      monthlyReportResponseSchema.safeParse({
        month: "2026-09",
        income: { value: "1,000.00", currency: "THB" },
        grossExpenses: { value: "500.50", currency: "THB" },
        refunds: { value: "100.25", currency: "THB" },
        netExpenses: { value: "400.25", currency: "THB" },
        net: { value: "599.75", currency: "THB" },
        transactionCount: 3,
      }).success,
    ).toBe(false);
    expect(
      monthlyReportResponseSchema.safeParse({
        month: "2026-09",
        income: { value: "1000.00", currency: "USD" },
        grossExpenses: { value: "500.50", currency: "THB" },
        refunds: { value: "100.25", currency: "THB" },
        netExpenses: { value: "400.25", currency: "THB" },
        net: { value: "599.75", currency: "THB" },
        transactionCount: 3,
      }).success,
    ).toBe(false);
    expect(
      monthlyReportResponseSchema.safeParse({
        month: "2026-09",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.50", currency: "THB" },
        refunds: { value: "100.25", currency: "THB" },
        netExpenses: { value: "400.25", currency: "THB" },
        net: { value: "599.75", currency: "THB" },
        transactionCount: -1,
      }).success,
    ).toBe(false);
    expect(
      monthlyReportResponseSchema.safeParse({
        month: "2026-09",
        income: { value: "1000.00", currency: "THB" },
        grossExpenses: { value: "500.50", currency: "THB" },
        refunds: { value: "100.25", currency: "THB" },
        netExpenses: { value: "400.25", currency: "THB" },
      }).success,
    ).toBe(false);
  });
});
