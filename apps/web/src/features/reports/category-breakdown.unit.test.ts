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
const GROCERIES_ID = "0199a0c4-0000-7000-8000-000000000005";
const RESTAURANTS_ID = "0199a0c4-0000-7000-8000-000000000006";
const FUEL_ID = "0199a0c4-0000-7000-8000-000000000007";

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
    directSpending: { value: "0.00", currency: "THB" },
    children: [],
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

  test("lists parents with more refunded than spent beneath the bar and shares out positive spending", () => {
    const breakdown = createCategoryBreakdown(
      spending("300.00", [
        parent(FOOD_ID, {
          sortOrder: 1,
          spending: { value: "300.00", currency: "THB" },
        }),
        parent(TRANSPORT_ID, {
          sortOrder: 2,
          spending: { value: "-100.00", currency: "THB" },
        }),
        parent(DEBT_ID, {
          sortOrder: 3,
          spending: { value: "100.00", currency: "THB" },
        }),
      ]),
    );

    expect(
      breakdown.segments.map(({ id, share, shareLabel }) => ({
        id,
        share,
        shareLabel,
      })),
    ).toEqual([
      { id: FOOD_ID, share: 0.75, shareLabel: "75%" },
      { id: DEBT_ID, share: 0.25, shareLabel: "25%" },
    ]);
    expect(breakdown.bar?.map((segment) => segment.id)).toEqual([
      FOOD_ID,
      DEBT_ID,
    ]);
    expect(
      breakdown.moreRefundedThanSpent.map(({ id, spending: amount }) => ({
        id,
        amount,
      })),
    ).toEqual([
      { id: TRANSPORT_ID, amount: { value: "-100.00", currency: "THB" } },
    ]);
  });

  test("draws no bar when Net expenses is zero or less, keeping the legend rows", () => {
    for (const netExpenses of ["0.00", "-50.00"]) {
      const refunded = netExpenses === "0.00" ? "-100.00" : "-150.00";
      const breakdown = createCategoryBreakdown(
        spending(netExpenses, [
          parent(FOOD_ID, { spending: { value: "100.00", currency: "THB" } }),
          parent(TRANSPORT_ID, {
            sortOrder: 2,
            spending: { value: refunded, currency: "THB" },
          }),
        ]),
      );

      expect(breakdown.bar).toBeNull();
      expect(
        breakdown.segments.map(({ id, share }) => ({ id, share })),
      ).toEqual([{ id: FOOD_ID, share: 1 }]);
      expect(breakdown.moreRefundedThanSpent.map(({ id }) => id)).toEqual([
        TRANSPORT_ID,
      ]);
      expect(breakdown.empty).toBe(false);
    }
  });

  test("keeps a parent whose refunds exactly cancel its spending in the legend but out of the bar", () => {
    const breakdown = createCategoryBreakdown(
      spending("100.00", [
        parent(FOOD_ID, { spending: { value: "100.00", currency: "THB" } }),
        parent(TRANSPORT_ID, { sortOrder: 2 }),
      ]),
    );

    expect(
      breakdown.segments.map(({ id, shareLabel }) => ({ id, shareLabel })),
    ).toEqual([
      { id: FOOD_ID, shareLabel: "100%" },
      { id: TRANSPORT_ID, shareLabel: "0%" },
    ]);
    expect(breakdown.bar?.map(({ id }) => id)).toEqual([FOOD_ID]);
    expect(breakdown.moreRefundedThanSpent).toEqual([]);
  });

  test("expands a parent into the amount filed directly on it and its children in category order", () => {
    const breakdown = createCategoryBreakdown(
      spending("300.00", [
        parent(FOOD_ID, {
          spending: { value: "300.00", currency: "THB" },
          directSpending: { value: "100.00", currency: "THB" },
          children: [
            {
              id: RESTAURANTS_ID,
              name: "Restaurants",
              sortOrder: 2,
              spending: { value: "-50.00", currency: "THB" },
            },
            {
              id: GROCERIES_ID,
              name: "Groceries",
              sortOrder: 1,
              spending: { value: "250.00", currency: "THB" },
            },
          ],
        }),
        parent(TRANSPORT_ID, {
          sortOrder: 2,
          spending: { value: "-80.00", currency: "THB" },
          children: [
            {
              id: FUEL_ID,
              name: "Fuel",
              sortOrder: 1,
              spending: { value: "-80.00", currency: "THB" },
            },
          ],
        }),
        parent(DEBT_ID, {
          sortOrder: 3,
          spending: { value: "80.00", currency: "THB" },
          directSpending: { value: "80.00", currency: "THB" },
        }),
      ]),
    );

    const [food, debt] = breakdown.segments;
    expect(food?.lines).toEqual([
      { kind: "direct", spending: { value: "100.00", currency: "THB" } },
      {
        kind: "child",
        id: GROCERIES_ID,
        name: "Groceries",
        spending: { value: "250.00", currency: "THB" },
      },
      {
        kind: "child",
        id: RESTAURANTS_ID,
        name: "Restaurants",
        spending: { value: "-50.00", currency: "THB" },
      },
    ]);
    // Only children make a row worth expanding.
    expect(debt?.lines).toEqual([]);
    // No direct line when nothing was filed on the parent itself.
    expect(breakdown.moreRefundedThanSpent[0]?.lines).toEqual([
      {
        kind: "child",
        id: FUEL_ID,
        name: "Fuel",
        spending: { value: "-80.00", currency: "THB" },
      },
    ]);
  });

  test("is empty when no expense or refund was dated in the month", () => {
    expect(createCategoryBreakdown(spending("0.00", []))).toEqual({
      segments: [],
      bar: null,
      moreRefundedThanSpent: [],
      empty: true,
    });
  });
});
