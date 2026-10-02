import type { CategorySummary } from "@bookkeeping/domain/categories";
import { describe, expect, test } from "vitest";
import { CATEGORY_HUES, createCategoryColors } from "./category-color";

interface CategoryFixtureOptions {
  id: string;
  parentId?: string | null;
  isProtected?: boolean;
}

function category({
  id,
  parentId = null,
  isProtected = false,
}: Readonly<CategoryFixtureOptions>): CategorySummary {
  return {
    id,
    kind: "expense",
    parentId,
    name: id,
    iconId: "generic",
    isProtected,
  };
}

describe("category color", () => {
  test("a child category takes its parent's color", () => {
    const colorOf = createCategoryColors([
      category({ id: "3f1c2a90-food" }),
      category({ id: "groceries", parentId: "3f1c2a90-food" }),
    ]);
    expect(colorOf("groceries")).toBe(colorOf("3f1c2a90-food"));
    expect(colorOf("groceries")).not.toBe("neutral");
  });

  test("parents spread across the whole palette", () => {
    const parents = Array.from({ length: 64 }, (_, index) =>
      category({
        id: `0b6f7e2c-41d9-4c3a-9e21-${String(index).padStart(12, "0")}`,
      }),
    );
    const colorOf = createCategoryColors(parents);
    const used = new Set(parents.map((parent) => colorOf(parent.id)));
    expect([...used].sort()).toEqual([...CATEGORY_HUES].sort());
  });

  test("time-ordered ids created together use every hue, none more than three times", () => {
    // UUIDv7s minted in one provisioning share their leading characters.
    const parents = [
      "01a0f7a9-cf52-7590-81e1-a36e668b6a6d",
      "01a0f7a9-cf58-7165-b569-8763952d1f00",
      "01a0f7a9-cf5f-7781-ac07-bca5c9805558",
      "01a0f7a9-cf64-79c9-89dd-33bd3398f9ab",
      "01a0f7a9-cf6b-7008-9cf2-3efca01e4f05",
      "01a0f7a9-cf71-71da-9ef6-27eaf1ce54e2",
      "01a0f7a9-cf75-767c-ae3d-951545e2cb68",
      "01a0f7a9-cf77-7f75-859c-ce736671de80",
      "01a0f7a9-cf7b-7583-8879-9b1eb94346b1",
      "01a0f7a9-cf7f-716a-aa8f-05a8fe5e0f83",
      "01a0f7a9-cf81-74c5-9a21-17843b7533c6",
      "01a0f7a9-cf83-70b6-9d0e-df69d76b0e20",
      "01a0f7a9-cf84-7dda-afc1-c89cb18afbd7",
      "01a0f7a9-cf87-7f7e-91df-e2b6da6b0b67",
    ].map((id) => category({ id }));
    const colorOf = createCategoryColors(parents);
    const counts = new Map<string, number>();
    for (const parent of parents) {
      const color = colorOf(parent.id);
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...CATEGORY_HUES].sort());
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  test("Uncategorized and an id missing from the list stay neutral", () => {
    const colorOf = createCategoryColors([
      category({ id: "uncategorized", isProtected: true }),
    ]);
    expect(colorOf("uncategorized")).toBe("neutral");
    expect(colorOf("not-in-the-list")).toBe("neutral");
  });

  test("adding or reordering categories never recolors an existing one", () => {
    const food = category({ id: "7d0e5b52-3c11-4f6a-8b0d-2a9f4e6c1d37" });
    const transport = category({ id: "c2a8f1e4-9b37-4d05-a6e2-5f1b0c7d9e48" });
    const colorsBefore = createCategoryColors([food, transport]);
    const colorsAfter = createCategoryColors([
      category({ id: "e5d4c3b2-a190-4f8e-9d7c-6b5a49382716" }),
      transport,
      food,
    ]);
    expect(colorsAfter(food.id)).toBe(colorsBefore(food.id));
    expect(colorsAfter(transport.id)).toBe(colorsBefore(transport.id));
  });
});
