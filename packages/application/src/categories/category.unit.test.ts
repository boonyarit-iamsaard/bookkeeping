import { describe, expect, test } from "vitest";
import type { CategoryCreationCommand } from "./category";
import { validateCategoryCreation } from "./category";

const command: CategoryCreationCommand = {
  kind: "expense",
  name: "Coffee",
  iconId: "coffee",
  parent: null,
};

describe("validateCategoryCreation", () => {
  test("normalizes the category and a newly created parent", () => {
    expect(
      validateCategoryCreation({
        ...command,
        name: "  Bubble tea  ",
        parent: {
          create: { name: "  Drinks  ", iconId: "beer" },
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        ...command,
        name: "Bubble tea",
        parent: { create: { name: "Drinks", iconId: "beer" } },
      },
    });
  });

  test("rejects an icon outside the shared catalog", () => {
    expect(
      validateCategoryCreation({ ...command, iconId: "retired-glyph" }),
    ).toEqual({
      ok: false,
      error: { code: "unknown-icon", field: "iconId" },
    });
  });
});
