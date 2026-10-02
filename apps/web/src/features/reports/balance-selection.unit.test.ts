import { expect, test } from "vitest";
import {
  moveBalanceSelection,
  resolveBalanceSelection,
} from "./balance-selection";
import { createBalanceTrend } from "./balance-trend";

test("a selected day losing its total commits one fallback for figures and markers", () => {
  const trend = createBalanceTrend(
    {
      month: "2026-09",
      entries: [
        { date: "2026-09-01", total: null },
        {
          date: "2026-09-02",
          total: { value: "20.00", currency: "THB" },
          wallet: null,
        },
        {
          date: "2026-09-03",
          total: { value: "30.00", currency: "THB" },
          wallet: { value: "10.00", currency: "THB" },
        },
      ],
    },
    "2026-09-03",
  );
  const result = resolveBalanceSelection({
    month: "2026-09",
    balanceDate: "2026-09-03",
    trend,
    previous: {
      month: "2026-09",
      balanceDate: "2026-09-03",
      date: "2026-09-01",
    },
  });
  expect(result.selected?.day).toEqual({
    date: "2026-09-03",
    total: { value: "30.00", currency: "THB" },
    wallet: { value: "10.00", currency: "THB" },
  });
  expect(result.selected?.point.date).toBe("2026-09-03");
  expect(result.selected?.walletPoint?.date).toBe("2026-09-03");
  expect(result.selected?.index).toBe(1);
  expect(result.memory.date).toBe("2026-09-03");
});

test("movement skips untracked dates, clamps keys, and breaks pointer ties toward the earlier day", () => {
  const trend = createBalanceTrend(
    {
      month: "2026-09",
      entries: [
        { date: "2026-09-01", total: { value: "10.00", currency: "THB" } },
        { date: "2026-09-02", total: null },
        { date: "2026-09-03", total: { value: "30.00", currency: "THB" } },
        { date: "2026-09-04", total: { value: "40.00", currency: "THB" } },
      ],
    },
    "2026-09-01",
  );
  const selection = resolveBalanceSelection({
    month: "2026-09",
    balanceDate: "2026-09-01",
    trend,
  });
  expect(
    moveBalanceSelection(selection, { type: "key", key: "ArrowRight" }).date,
  ).toBe("2026-09-03");
  expect(
    moveBalanceSelection(selection, { type: "key", key: "PageUp" }).date,
  ).toBe("2026-09-04");
  expect(
    moveBalanceSelection(selection, { type: "key", key: "PageDown" }).date,
  ).toBe("2026-09-01");
  expect(
    moveBalanceSelection(selection, { type: "key", key: "End" }).date,
  ).toBe("2026-09-04");
  expect(
    moveBalanceSelection(selection, { type: "key", key: "Home" }).date,
  ).toBe("2026-09-01");
  expect(
    moveBalanceSelection(selection, { type: "pointer", position: 1 / 29 }).date,
  ).toBe("2026-09-01");
  expect(
    moveBalanceSelection(selection, { type: "pointer", position: 2 / 29 }).date,
  ).toBe("2026-09-03");
});

test("refresh retains a manual choice, commits fallback, and never revives a restored date", () => {
  const balances = {
    month: "2026-09",
    entries: [
      {
        date: "2026-09-01",
        total: { value: "10.00", currency: "THB" as const },
      },
      {
        date: "2026-09-02",
        total: { value: "20.00", currency: "THB" as const },
      },
      {
        date: "2026-09-03",
        total: { value: "30.00", currency: "THB" as const },
      },
    ],
  };
  const options = {
    month: "2026-09",
    balanceDate: "2026-09-02",
    trend: createBalanceTrend(balances, "2026-09-02"),
  };
  const initial = resolveBalanceSelection(options);
  const manual = moveBalanceSelection(initial, { type: "key", key: "Home" });
  const compared = resolveBalanceSelection({
    ...options,
    previous: manual,
    trend: createBalanceTrend(
      {
        ...balances,
        entries: balances.entries.map((entry) => ({ ...entry, wallet: null })),
      },
      "2026-09-02",
    ),
  });
  expect(compared.selected?.day.date).toBe("2026-09-01");
  expect(compared.selected?.day.wallet).toBeNull();
  expect(compared.selected?.walletPoint).toBeUndefined();
  const fallback = resolveBalanceSelection({
    ...options,
    previous: compared.memory,
    trend: createBalanceTrend(
      {
        ...balances,
        entries: balances.entries.slice(1),
      },
      "2026-09-02",
    ),
  });
  expect(fallback.selected?.day.date).toBe("2026-09-02");
  const restored = resolveBalanceSelection({
    ...options,
    previous: fallback.memory,
  });
  expect(restored.selected?.day.date).toBe("2026-09-02");
  const changedDate = resolveBalanceSelection({
    ...options,
    balanceDate: "2026-09-03",
    previous: manual,
    trend: createBalanceTrend(balances, "2026-09-03"),
  });
  expect(changedDate.selected?.day.date).toBe("2026-09-03");
  const changedMonth = resolveBalanceSelection({
    ...options,
    month: "2026-10",
    previous: manual,
    trend: createBalanceTrend(
      {
        month: "2026-10",
        entries: [
          { date: "2026-10-01", total: { value: "40.00", currency: "THB" } },
        ],
      },
      "2026-09-02",
    ),
  });
  expect(changedMonth.selected?.day.date).toBe("2026-10-01");
  const empty = resolveBalanceSelection({
    ...options,
    previous: manual,
    trend: { kind: "untracked" },
  });
  expect(empty.selected).toBeUndefined();
  expect(empty.memory.date).toBeUndefined();
  expect(
    resolveBalanceSelection({ ...options, previous: empty.memory }).selected
      ?.day.date,
  ).toBe("2026-09-02");
});

test("Page keys move seven tracked positions rather than seven calendar dates", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, "0")}`,
    total: index === 2 ? null : { value: "10.00", currency: "THB" as const },
  }));
  const selection = resolveBalanceSelection({
    month: "2026-09",
    balanceDate: "2026-09-01",
    trend: createBalanceTrend({ month: "2026-09", entries }, "2026-09-01"),
  });
  const next = moveBalanceSelection(selection, { type: "key", key: "PageUp" });
  expect(next.date).toBe("2026-09-09");
  expect(
    moveBalanceSelection(
      resolveBalanceSelection({
        month: "2026-09",
        balanceDate: "2026-09-01",
        trend: createBalanceTrend({ month: "2026-09", entries }, "2026-09-01"),
        previous: next,
      }),
      { type: "key", key: "PageDown" },
    ).date,
  ).toBe("2026-09-01");
});
