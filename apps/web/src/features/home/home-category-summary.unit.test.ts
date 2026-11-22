import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { createCategoryBreakdown } from "@/features/reports/category-breakdown";
import { createHomeCategorySummary } from "./home-category-summary";

type ParentCategorySpending = components["schemas"]["ParentCategorySpending"];

function parent(position: number, amount: string): ParentCategorySpending {
  return {
    id: `0199a0c4-0000-7000-8000-00000000000${position}`,
    name: `Parent ${position}`,
    sortOrder: position,
    isUncategorized: false,
    spending: { value: amount, currency: "THB" },
    directSpending: { value: amount, currency: "THB" },
    children: [],
  };
}

function breakdownOf(amounts: readonly string[]) {
  const total = amounts
    .filter((amount) => !amount.startsWith("-"))
    .reduce((sum, amount) => sum + Number(amount), 0)
    .toFixed(2);
  return createCategoryBreakdown({
    month: "2026-09",
    netExpenses: { value: total, currency: "THB" },
    shareBase: { value: total, currency: "THB" },
    parents: amounts.map((amount, index) => parent(index + 1, amount)),
  });
}

describe("createHomeCategorySummary", () => {
  test("keeps the six largest parents and counts the rest", () => {
    const summary = createHomeCategorySummary(
      breakdownOf([
        "10.00",
        "20.00",
        "30.00",
        "40.00",
        "50.00",
        "60.00",
        "5.00",
        "1.00",
      ]),
    );

    expect(summary.breakdown.segments.map((segment) => segment.name)).toEqual([
      "Parent 6",
      "Parent 5",
      "Parent 4",
      "Parent 3",
      "Parent 2",
      "Parent 1",
    ]);
    expect(summary.hiddenCount).toBe(2);
  });

  test("counts a parent refunded past its spending among those not shown", () => {
    const summary = createHomeCategorySummary(breakdownOf(["10.00", "-3.00"]));

    expect(summary.breakdown.segments).toHaveLength(1);
    expect(summary.breakdown.moreRefundedThanSpent).toEqual([]);
    expect(summary.hiddenCount).toBe(1);
  });

  test("hides nothing for a month that fits", () => {
    expect(createHomeCategorySummary(breakdownOf(["10.00"])).hiddenCount).toBe(
      0,
    );
  });
});
