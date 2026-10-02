import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { parentCategoryColor } from "@/features/categories/category-color";
import { createCategoryBreakdown } from "./category-breakdown";

type CategorySpending = components["schemas"]["CategorySpending"];
type ParentCategorySpending = components["schemas"]["ParentCategorySpending"];

const FOOD_ID = "0199a0c4-0000-7000-8000-000000000001";
const TRANSPORT_ID = "0199a0c4-0000-7000-8000-000000000002";
const DEBT_ID = "0199a0c4-0000-7000-8000-000000000003";
const UNCATEGORIZED_ID = "0199a0c4-0000-7000-8000-000000000004";

function parent(
  id: string,
  overrides: Readonly<Partial<ParentCategorySpending>> = {},
): ParentCategorySpending {
  return {
    id,
    name: id,
    sortOrder: 1,
    isUncategorized: false,
    spending: { value: "0.00", currency: "THB" },
    ...overrides,
  };
}

function spending(
  netExpenses: string,
  parents: readonly ParentCategorySpending[],
): CategorySpending {
  return {
    month: "2026-09",
    netExpenses: { value: netExpenses, currency: "THB" },
    parents: [...parents],
  };
}

describe("createCategoryBreakdown", () => {
  test("orders parents by sort order with Uncategorized last", () => {
    const breakdown = createCategoryBreakdown(
      spending("40.00", [
        parent(UNCATEGORIZED_ID, {
          sortOrder: 0,
          isUncategorized: true,
          spending: { value: "10.00", currency: "THB" },
        }),
        parent(DEBT_ID, {
          sortOrder: 9,
          spending: { value: "10.00", currency: "THB" },
        }),
        parent(FOOD_ID, {
          sortOrder: 1,
          spending: { value: "10.00", currency: "THB" },
        }),
        parent(TRANSPORT_ID, {
          sortOrder: 2,
          spending: { value: "10.00", currency: "THB" },
        }),
      ]),
    );

    expect(breakdown.segments.map((segment) => segment.id)).toEqual([
      FOOD_ID,
      TRANSPORT_ID,
      DEBT_ID,
      UNCATEGORIZED_ID,
    ]);
  });

  test("keeps each parent's exact amount and states its share of spending", () => {
    const breakdown = createCategoryBreakdown(
      spending("1600.00", [
        parent(FOOD_ID, {
          name: "Food & Drink",
          sortOrder: 1,
          spending: { value: "450.00", currency: "THB" },
        }),
        parent(TRANSPORT_ID, {
          name: "Transport",
          sortOrder: 2,
          spending: { value: "150.00", currency: "THB" },
        }),
        parent(DEBT_ID, {
          name: "Debt payments",
          sortOrder: 3,
          spending: { value: "1000.00", currency: "THB" },
        }),
      ]),
    );

    expect(
      breakdown.segments.map(
        ({ name, spending: amount, share, shareLabel }) => ({
          name,
          amount,
          share,
          shareLabel,
        }),
      ),
    ).toEqual([
      {
        name: "Food & Drink",
        amount: { value: "450.00", currency: "THB" },
        share: 0.28125,
        shareLabel: "28%",
      },
      {
        name: "Transport",
        amount: { value: "150.00", currency: "THB" },
        share: 0.09375,
        shareLabel: "9%",
      },
      {
        name: "Debt payments",
        amount: { value: "1000.00", currency: "THB" },
        share: 0.625,
        shareLabel: "63%",
      },
    ]);
    expect(breakdown.empty).toBe(false);
  });

  test("never states a share with spending as 0%", () => {
    const breakdown = createCategoryBreakdown(
      spending("1000.01", [
        parent(FOOD_ID, { spending: { value: "1000.00", currency: "THB" } }),
        parent(TRANSPORT_ID, {
          sortOrder: 2,
          spending: { value: "0.01", currency: "THB" },
        }),
      ]),
    );

    expect(breakdown.segments.map((segment) => segment.shareLabel)).toEqual([
      "100%",
      "<1%",
    ]);
  });

  test("colors a parent by its own hue and Uncategorized as hatched neutral", () => {
    const breakdown = createCategoryBreakdown(
      spending("20.00", [
        parent(FOOD_ID, { spending: { value: "10.00", currency: "THB" } }),
        parent(UNCATEGORIZED_ID, {
          sortOrder: 0,
          isUncategorized: true,
          spending: { value: "10.00", currency: "THB" },
        }),
      ]),
    );

    expect(
      breakdown.segments.map(({ color, isUncategorized }) => ({
        color,
        isUncategorized,
      })),
    ).toEqual([
      {
        color: parentCategoryColor({ id: FOOD_ID, isProtected: false }),
        isUncategorized: false,
      },
      { color: "neutral", isUncategorized: true },
    ]);
  });

  test("is empty when no expense or refund was dated in the month", () => {
    expect(createCategoryBreakdown(spending("0.00", []))).toEqual({
      segments: [],
      empty: true,
    });
  });
});
