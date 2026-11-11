import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import type { ReportViewReads } from "./report-view";
import { buildReportView, comparisonStandIn, totalsOnly } from "./report-view";

type ClosingBalances = components["schemas"]["ClosingBalances"];
type MonthlyReport = components["schemas"]["MonthlyReport"];
type CategorySpending = components["schemas"]["CategorySpending"];
type WalletCollection = components["schemas"]["WalletCollection"];

function balances(month: string, withWallet: boolean): ClosingBalances {
  const total = { value: "100.00", currency: "THB" } as const;
  const wallet = { value: "40.00", currency: "THB" } as const;
  return {
    month,
    entries: [
      { date: `${month}-01`, total, ...(withWallet ? { wallet } : {}) },
      { date: `${month}-02`, total: null, ...(withWallet ? { wallet } : {}) },
    ],
  };
}

describe("totalsOnly", () => {
  test("keeps each day's total and drops every Wallet figure", () => {
    expect(totalsOnly(balances("2026-09", true))).toEqual(
      balances("2026-09", false),
    );
  });
});

describe("comparisonStandIn", () => {
  test("keeps the previous closing balances while the month is unchanged", () => {
    const previous = balances("2026-09", true);
    expect(
      comparisonStandIn({
        previous,
        month: "2026-09",
        uncompared: balances("2026-09", false),
      }),
    ).toBe(previous);
  });

  test("falls back to the cached uncompared closing balances after a month switch", () => {
    const uncompared = balances("2026-10", false);
    expect(
      comparisonStandIn({
        previous: balances("2026-09", true),
        month: "2026-10",
        uncompared,
      }),
    ).toBe(uncompared);
  });

  test("has nothing to show after a month switch when the uncompared balances are not cached", () => {
    expect(
      comparisonStandIn({
        previous: balances("2026-09", true),
        month: "2026-10",
        uncompared: undefined,
      }),
    ).toBeUndefined();
  });

  test("has nothing to show before any closing balances were read", () => {
    expect(
      comparisonStandIn({
        previous: undefined,
        month: "2026-09",
        uncompared: undefined,
      }),
    ).toBeUndefined();
  });
});

const THB_ZERO = { value: "0.00", currency: "THB" } as const;

function monthlyReport(month: string): MonthlyReport {
  return {
    month,
    income: THB_ZERO,
    grossExpenses: THB_ZERO,
    refunds: THB_ZERO,
    netExpenses: THB_ZERO,
    net: THB_ZERO,
    transactionCount: 0,
  };
}

const emptyCategorySpending: CategorySpending = {
  month: "2026-09",
  netExpenses: THB_ZERO,
  shareBase: THB_ZERO,
  parents: [],
};

function walletCollection(total: string): WalletCollection {
  return {
    items: [],
    page: { nextCursor: null },
    balance: {
      total: { value: total, currency: "THB" },
      spendable: null,
      setAside: null,
      walletCount: 0,
      spendableWalletCount: 0,
      savingsWalletCount: 0,
    },
  };
}

const VALID_ADDRESS = {
  valid: true,
  values: { month: "2026-09", asOf: "2026-09-02" },
  invalidFields: new Set<"month" | "asOf">(),
};

const TREND_MONTHS = [
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
];

function readyReads(
  overrides: Readonly<Partial<ReportViewReads>> = {},
): ReportViewReads {
  return {
    monthly: monthlyReport("2026-09"),
    categorySpending: emptyCategorySpending,
    closingBalances: { data: balances("2026-09", false), isStandIn: false },
    currentWallets: walletCollection("500.00"),
    datedWallets: walletCollection("300.00"),
    trend: TREND_MONTHS.map(monthlyReport),
    ...overrides,
  };
}

describe("buildReportView", () => {
  test("is invalid for a malformed address, naming the fields to correct", () => {
    const view = buildReportView({
      address: {
        valid: false,
        values: { month: "2026-13", asOf: "2026-09-02" },
        invalidFields: new Set(["month"]),
      },
      reads: {
        monthly: undefined,
        categorySpending: undefined,
        closingBalances: { data: undefined, isStandIn: false },
        currentWallets: undefined,
        datedWallets: undefined,
        trend: [],
      },
    });
    expect(view).toEqual({
      state: "invalid",
      values: { month: "2026-13", asOf: "2026-09-02" },
      invalidFields: new Set(["month"]),
    });
  });

  test("shows no figures for an invalid address, whatever reads are present", () => {
    const view = buildReportView({
      address: {
        valid: false,
        values: { month: "2026-09", asOf: "2026-02-30" },
        invalidFields: new Set(["asOf"]),
      },
      reads: readyReads(),
    });
    expect(view.state).toBe("invalid");
    expect(view).not.toHaveProperty("summary");
  });

  test.each([
    ["monthly report", { monthly: undefined }],
    ["Category spending", { categorySpending: undefined }],
    [
      "closing balances",
      { closingBalances: { data: undefined, isStandIn: false } },
    ],
    ["current Wallets", { currentWallets: undefined }],
    ["dated Wallets", { datedWallets: undefined }],
  ] satisfies [string, Partial<ReportViewReads>][])(
    "is loading while the %s is pending",
    (_name, pending) => {
      const view = buildReportView({
        address: VALID_ADDRESS,
        reads: readyReads(pending),
      });
      expect(view).toEqual({
        state: "loading",
        values: VALID_ADDRESS.values,
        invalidFields: VALID_ADDRESS.invalidFields,
      });
    },
  );

  test("is loading while the trend is still filling", () => {
    const view = buildReportView({
      address: VALID_ADDRESS,
      reads: readyReads({
        trend: [...TREND_MONTHS.slice(0, 5).map(monthlyReport), undefined],
      }),
    });
    expect(view.state).toBe("loading");
  });

  test("is ready with every derived figure once all reads are in", () => {
    const summary = monthlyReport("2026-09");
    const view = buildReportView({
      address: VALID_ADDRESS,
      reads: readyReads({ monthly: summary }),
    });
    if (view.state !== "ready") {
      throw new Error(`expected a ready view, got ${view.state}`);
    }
    expect(view.values).toEqual(VALID_ADDRESS.values);
    expect(view.summary).toBe(summary);
    expect(view.categoryBreakdown.empty).toBe(true);
    expect(view.balanceTrend).toMatchObject({
      kind: "line",
      selected: "2026-09-01",
    });
    expect(view.trend.map((point) => point.month)).toEqual(TREND_MONTHS);
    expect(view.currentTotal).toEqual({ value: "500.00", currency: "THB" });
    expect(view.datedTotal).toEqual({ value: "300.00", currency: "THB" });
    expect(view.currentWallets).toEqual([]);
    expect(view.datedWallets).toEqual([]);
  });

  test("draws the compared Wallet's line from settled closing balances", () => {
    const view = buildReportView({
      address: VALID_ADDRESS,
      reads: readyReads({
        closingBalances: { data: balances("2026-09", true), isStandIn: false },
      }),
    });
    expect(view).toMatchObject({
      state: "ready",
      balanceTrend: { kind: "line", walletRuns: [expect.any(Array)] },
    });
  });

  test("shows totals only while a stand-in holds the place of a pending comparison", () => {
    const view = buildReportView({
      address: VALID_ADDRESS,
      reads: readyReads({
        closingBalances: { data: balances("2026-09", true), isStandIn: true },
      }),
    });
    expect(view).toMatchObject({
      state: "ready",
      balanceTrend: { kind: "line", walletRuns: [] },
    });
  });
});
