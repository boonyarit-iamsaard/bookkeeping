import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { createTrendSeries, trendMonths } from "./trend-series";

type MonthlyReport = components["schemas"]["MonthlyReport"];

describe("trendMonths", () => {
  test("is the six months ending at the chosen one, oldest first", () => {
    expect(trendMonths("2026-09")).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });

  test("crosses a year boundary", () => {
    expect(trendMonths("2026-02")).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  test("stops at the first month the calendar has", () => {
    expect(trendMonths("0001-03")).toEqual(["0001-01", "0001-02", "0001-03"]);
  });
});

function report(
  month: string,
  overrides: Partial<MonthlyReport> = {},
): MonthlyReport {
  const zero = { value: "0.00", currency: "THB" } as const;
  return {
    month,
    income: zero,
    grossExpenses: zero,
    refunds: zero,
    netExpenses: zero,
    net: zero,
    transactionCount: 0,
    ...overrides,
  };
}

describe("createTrendSeries", () => {
  test("reads income and net expenses exactly, in the reports' order", () => {
    expect(
      createTrendSeries([
        report("2026-08", {
          income: { value: "1000.10", currency: "THB" },
          netExpenses: { value: "400.05", currency: "THB" },
          transactionCount: 3,
        }),
        report("2026-09", {
          income: { value: "0.00", currency: "THB" },
          netExpenses: { value: "12.50", currency: "THB" },
          transactionCount: 1,
        }),
      ]),
    ).toEqual([
      { month: "2026-08", income: 100010n, netExpenses: 40005n, empty: false },
      { month: "2026-09", income: 0n, netExpenses: 1250n, empty: false },
    ]);
  });

  test("marks a month with no transactions empty", () => {
    expect(createTrendSeries([report("2026-07")])).toEqual([
      { month: "2026-07", income: 0n, netExpenses: 0n, empty: true },
    ]);
  });
});
