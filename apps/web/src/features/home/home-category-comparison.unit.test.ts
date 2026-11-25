import { describe, expect, test } from "vitest";
import type { CategorySpending } from "@/features/reports/category-breakdown";
import { compareCategorySpending } from "./home-category-comparison";

function spendingOf(
  month: string,
  amounts: Readonly<Record<number, string>>,
): CategorySpending {
  function money(value: string) {
    return { value, currency: "THB" as const };
  }
  return {
    month,
    netExpenses: money("0.00"),
    shareBase: money("0.00"),
    parents: Object.entries(amounts).map(([position, amount]) => ({
      id: `0199a0c4-0000-7000-8000-00000000000${position}`,
      name: `Parent ${position}`,
      sortOrder: Number(position),
      isUncategorized: false,
      spending: money(amount),
      directSpending: money(amount),
      children: [],
    })),
  };
}

describe("compareCategorySpending", () => {
  test("pairs each parent's months, this month's largest first, then last month's", () => {
    const { rows, hiddenCount } = compareCategorySpending(
      spendingOf("2026-10", { 1: "50.00", 2: "100.00" }),
      spendingOf("2026-09", { 1: "200.00", 3: "30.00" }),
    );

    expect(
      rows.map((row) => [
        row.name,
        row.current.value,
        row.previous.value,
        row.currentShare,
        row.previousShare,
      ]),
    ).toEqual([
      ["Parent 2", "100.00", "0.00", 0.5, 0],
      ["Parent 1", "50.00", "200.00", 0.25, 1],
      ["Parent 3", "0.00", "30.00", 0, 0.15],
    ]);
    expect(hiddenCount).toBe(0);
  });

  test("keeps six parents, counts the rest, and draws no bar below zero", () => {
    const { rows, hiddenCount } = compareCategorySpending(
      spendingOf("2026-10", {
        1: "10.00",
        2: "20.00",
        3: "30.00",
        4: "40.00",
        5: "50.00",
        6: "60.00",
        7: "-5.00",
      }),
      spendingOf("2026-09", { 8: "1.00" }),
    );

    expect(rows.map((row) => row.name)).toEqual([
      "Parent 6",
      "Parent 5",
      "Parent 4",
      "Parent 3",
      "Parent 2",
      "Parent 1",
    ]);
    expect(hiddenCount).toBe(2);
    expect(
      compareCategorySpending(
        spendingOf("2026-10", { 1: "-5.00" }),
        spendingOf("2026-09", {}),
      ).rows[0]?.currentShare,
    ).toBe(0);
  });
});
