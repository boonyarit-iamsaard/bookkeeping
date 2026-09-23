import { describe, expect, test } from "vitest";
import { historyFilterChips } from "./history-chips";

const CASH = "00000000-0000-4000-8000-000000000001";
const FOOD = "00000000-0000-4000-8000-000000000002";
const names = {
  wallets: [{ id: CASH, name: "Cash" }],
  categories: [{ id: FOOD, name: "Food" }],
};

describe("history filter chips", () => {
  test("names each active filter in the sheet's order", () => {
    expect(
      historyFilterChips(
        {
          type: "expense",
          categoryId: FOOD,
          walletId: CASH,
          to: "2026-09-03",
          from: "2026-09-01",
        },
        names,
      ).map((chip) => chip.label),
    ).toEqual(["From 1 Sep 2026", "To 3 Sep 2026", "Cash", "Food", "Expense"]);
  });

  test("removing a chip keeps the other filters and drops the page and saved id", () => {
    const [from] = historyFilterChips(
      {
        from: "2026-09-01",
        type: "income",
        cursor: "eyJ2IjoxfQ",
        created: CASH,
      },
      names,
    );
    expect(from?.without).toEqual({ type: "income" });
  });

  test("shows values it cannot name as typed", () => {
    expect(
      historyFilterChips(
        { from: "0000-01-01", walletId: "gone", type: "7" },
        names,
      ).map((chip) => chip.label),
    ).toEqual(["From 0000-01-01", "gone", "7"]);
  });

  test("has no chips without filters", () => {
    expect(historyFilterChips({ cursor: "x" }, names)).toEqual([]);
  });
});
