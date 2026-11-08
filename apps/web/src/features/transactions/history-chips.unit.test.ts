import { describe, expect, test } from "vitest";
import { historyFilterChips } from "./history-chips";

const CASH = "00000000-0000-4000-8000-000000000001";
const FOOD = "00000000-0000-4000-8000-000000000002";
const COFFEE = "00000000-0000-4000-8000-000000000003";
const SNACKS = "00000000-0000-4000-8000-000000000004";
const names = {
  wallets: [{ id: CASH, name: "Cash" }],
  categories: [{ id: FOOD, name: "Food" }],
  tags: [
    { id: COFFEE, name: "Coffee" },
    { id: SNACKS, name: "Snacks" },
  ],
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

  test("marks a value the history rejects as invalid", () => {
    expect(
      historyFilterChips(
        { from: "2026-09-01", walletId: "gone", type: "7" },
        names,
      ).map((chip) => chip.invalid),
    ).toEqual([false, true, true]);
  });

  test("gives each chosen tag its own chip that lifts only that tag", () => {
    const chips = historyFilterChips(
      { type: "expense", tagId: [COFFEE, SNACKS] },
      names,
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "Expense",
      "# Coffee",
      "# Snacks",
    ]);
    expect(chips[1]?.without).toEqual({ type: "expense", tagId: [SNACKS] });
    expect(chips[2]?.without).toEqual({ type: "expense", tagId: [COFFEE] });
  });

  test("drops the tag filter with its last tag and flags an unknown one", () => {
    const [chip] = historyFilterChips({ tagId: ["gone"] }, names);
    expect(chip).toMatchObject({ label: "# gone", invalid: true, without: {} });
  });

  test("has no chips without filters", () => {
    expect(historyFilterChips({ cursor: "x" }, names)).toEqual([]);
  });
});
