import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { createBalanceTrend } from "./balance-trend";

type ClosingBalances = components["schemas"]["ClosingBalances"];

/** One entry per value from the month's first day; null before any wallet opened. */
function balances(
  month: string,
  totals: readonly (string | null)[],
): ClosingBalances {
  return {
    month,
    entries: totals.map((total, index) => ({
      date: `${month}-${String(index + 1).padStart(2, "0")}`,
      total: total === null ? null : { value: total, currency: "THB" },
    })),
  };
}

/** Adds a compared wallet's figures to the same days, in order. */
function withWallet(
  totals: Readonly<ClosingBalances>,
  wallet: readonly (string | null)[],
): ClosingBalances {
  return {
    ...totals,
    entries: totals.entries.map((entry, index) => {
      const value = wallet[index] ?? null;
      return {
        ...entry,
        wallet: value === null ? null : { value, currency: "THB" },
      };
    }),
  };
}

describe("createBalanceTrend", () => {
  test("a future month has nothing yet", () => {
    expect(createBalanceTrend(balances("2026-10", []), "2026-09-30")).toEqual({
      kind: "future",
    });
  });

  test("a month entirely before every opening date has no line", () => {
    expect(
      createBalanceTrend(balances("2026-02", [null, null, null]), "2026-02-02"),
    ).toEqual({ kind: "untracked" });
  });

  test("reads every day exactly and places it across the whole month", () => {
    const trend = createBalanceTrend(
      balances("2026-09", ["100.00", "50.00", "200.00"]),
      "2026-09-02",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.days).toEqual([
      { date: "2026-09-01", total: { value: "100.00", currency: "THB" } },
      { date: "2026-09-02", total: { value: "50.00", currency: "THB" } },
      { date: "2026-09-03", total: { value: "200.00", currency: "THB" } },
    ]);
    // September has 30 days; the line stops at the last entry, today. The
    // plot spans the month's own lowest to highest balance.
    expect(trend.runs).toEqual([
      [
        { date: "2026-09-01", x: 0, y: 1 / 3 },
        { date: "2026-09-02", x: 1 / 29, y: 0 },
        { date: "2026-09-03", x: 2 / 29, y: 1 },
      ],
    ]);
  });

  test("leaves a gap where a day has no balance, so the line starts on the earliest opening date", () => {
    const trend = createBalanceTrend(
      balances("2026-09", [null, null, "300.00", "300.00"]),
      "2026-09-04",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.runs.map((run) => run.map((point) => point.date))).toEqual([
      ["2026-09-03", "2026-09-04"],
    ]);
    expect(trend.days[0]).toEqual({ date: "2026-09-01", total: null });
  });

  test("splits the line into runs around a missing day", () => {
    const trend = createBalanceTrend(
      balances("2026-09", ["1.00", null, "1.00"]),
      "2026-09-03",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.runs.map((run) => run.map((point) => point.date))).toEqual([
      ["2026-09-01"],
      ["2026-09-03"],
    ]);
  });

  test("draws the zero line only when a balance in view is negative, widening the plot to it", () => {
    const positive = createBalanceTrend(
      balances("2026-09", ["10.00", "20.00"]),
      "2026-09-02",
    );
    const overdrawn = createBalanceTrend(
      balances("2026-09", ["-10.00", "30.00"]),
      "2026-09-02",
    );
    if (positive.kind !== "line" || overdrawn.kind !== "line") {
      throw new Error("Expected lines");
    }
    expect(positive.zero).toBeNull();
    expect(overdrawn.zero).toBe(0.25);
    expect(overdrawn.runs[0]?.map((point) => point.y)).toEqual([0, 1]);

    const underwater = createBalanceTrend(
      balances("2026-09", ["-10.00", "-30.00"]),
      "2026-09-02",
    );
    if (underwater.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(underwater.zero).toBe(1);
    expect(underwater.runs[0]?.map((point) => point.y)).toEqual([2 / 3, 0]);
  });

  test("draws an unchanging balance across the middle", () => {
    const trend = createBalanceTrend(
      balances("2026-09", ["500.00", "500.00"]),
      "2026-09-02",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.runs[0]?.map((point) => point.y)).toEqual([0.5, 0.5]);
  });

  test("selects the Balance date when the month has a balance for it", () => {
    const trend = createBalanceTrend(
      balances("2026-09", ["1.00", "2.00", "3.00"]),
      "2026-09-02",
    );
    expect(trend.kind === "line" && trend.selected).toBe("2026-09-02");
  });

  test("otherwise selects the month's last day with a balance", () => {
    const outsideMonth = createBalanceTrend(
      balances("2026-09", ["1.00", "2.00", "3.00"]),
      "2026-10-01",
    );
    const beforeOpening = createBalanceTrend(
      balances("2026-09", [null, "2.00", "3.00"]),
      "2026-09-01",
    );
    expect(outsideMonth.kind === "line" && outsideMonth.selected).toBe(
      "2026-09-03",
    );
    expect(beforeOpening.kind === "line" && beforeOpening.selected).toBe(
      "2026-09-03",
    );
  });

  test("draws no wallet line when no wallet is compared", () => {
    const trend = createBalanceTrend(
      balances("2026-09", ["1.00", "2.00"]),
      "2026-09-02",
    );
    expect(trend.kind === "line" && trend.walletRuns).toEqual([]);
  });

  test("adds the compared wallet as its own series, with its own gaps, on the shared scale", () => {
    const trend = createBalanceTrend(
      withWallet(
        balances("2026-09", ["100.00", "300.00", "400.00", "200.00"]),
        [null, "0.00", null, "100.00"],
      ),
      "2026-09-04",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.days[1]).toEqual({
      date: "2026-09-02",
      total: { value: "300.00", currency: "THB" },
      wallet: { value: "0.00", currency: "THB" },
    });
    // The plot spans both lines: 0.00 at the bottom, 400.00 at the top.
    expect(trend.runs[0]?.map((point) => point.y)).toEqual([
      0.25, 0.75, 1, 0.5,
    ]);
    expect(trend.walletRuns).toEqual([
      [{ date: "2026-09-02", x: 1 / 29, y: 0 }],
      [{ date: "2026-09-04", x: 3 / 29, y: 0.25 }],
    ]);
    expect(trend.zero).toBeNull();
  });

  test("draws the zero line when only the compared wallet is negative", () => {
    const trend = createBalanceTrend(
      withWallet(balances("2026-09", ["30.00", "30.00"]), ["-10.00", "10.00"]),
      "2026-09-02",
    );
    if (trend.kind !== "line") {
      throw new Error("Expected a line");
    }
    expect(trend.zero).toBe(0.25);
    expect(trend.walletRuns[0]?.map((point) => point.y)).toEqual([0, 0.5]);
  });
});
