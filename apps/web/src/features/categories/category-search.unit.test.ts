import type { CategorySummary } from "@bookkeeping/domain/categories";
import { describe, expect, test } from "vitest";
import { searchCategories } from "./category-search";

interface CategoryFixtureOptions {
  id: string;
  name: string;
  parentId?: string | null;
  kind?: CategorySummary["kind"];
}

function category({
  id,
  name,
  parentId = null,
  kind = "expense",
}: Readonly<CategoryFixtureOptions>): CategorySummary {
  return { id, kind, parentId, name, iconId: "generic", isProtected: false };
}

const tree = [
  category({ id: "u", name: "Uncategorized" }),
  category({ id: "food", name: "Food & Drink" }),
  category({ id: "groceries", name: "Groceries", parentId: "food" }),
  category({ id: "coffee", name: "Coffee & snacks", parentId: "food" }),
  category({ id: "transport", name: "Transport" }),
  category({ id: "fuel", name: "Fuel", parentId: "transport" }),
  category({ id: "salary", name: "Salary", parentId: null, kind: "income" }),
];

describe("category search", () => {
  test("an empty query lists the whole tree of the active kind, children under parents", () => {
    const result = searchCategories({
      categories: tree,
      kind: "expense",
      query: "",
    });
    expect(
      result.groups.map((g) => [g.parent.id, g.children.map((c) => c.id)]),
    ).toEqual([
      ["u", []],
      ["food", ["groceries", "coffee"]],
      ["transport", ["fuel"]],
    ]);
    expect(result.exactMatch).toBe(false);
  });

  test("a query matching a child shows it under its parent; a query matching a parent shows all its children", () => {
    const child = searchCategories({
      categories: tree,
      kind: "expense",
      query: "groc",
    });
    expect(
      child.groups.map((g) => [
        g.parent.id,
        g.parentMatches,
        g.children.map((c) => c.id),
      ]),
    ).toEqual([["food", false, ["groceries"]]]);
    const parent = searchCategories({
      categories: tree,
      kind: "expense",
      query: "FOOD",
    });
    expect(
      parent.groups.map((g) => [
        g.parent.id,
        g.parentMatches,
        g.children.map((c) => c.id),
      ]),
    ).toEqual([["food", true, ["groceries", "coffee"]]]);
  });

  test("an exact name at either level is reported so creation is not offered twice", () => {
    expect(
      searchCategories({
        categories: tree,
        kind: "expense",
        query: " coffee & snacks ",
      }).exactMatch,
    ).toBe(true);
    expect(
      searchCategories({
        categories: tree,
        kind: "expense",
        query: "transport",
      }).exactMatch,
    ).toBe(true);
    expect(
      searchCategories({
        categories: tree,
        kind: "expense",
        query: "Bubble tea",
      }).exactMatch,
    ).toBe(false);
    expect(
      searchCategories({
        categories: tree,
        kind: "expense",
        query: "Bubble tea",
      }).groups,
    ).toEqual([]);
  });

  test("the other tree never leaks in", () => {
    expect(
      searchCategories({ categories: tree, kind: "expense", query: "salary" })
        .groups,
    ).toEqual([]);
  });
});
