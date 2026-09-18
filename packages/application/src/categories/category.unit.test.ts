import { describe, expect, test } from "vitest";
import type {
  CategoryCreationCommand,
  CategoryUpdateCommand,
} from "./category";
import { validateCategoryCreation, validateCategoryUpdate } from "./category";

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

describe("validateCategoryUpdate", () => {
  const update: CategoryUpdateCommand = { name: "Groceries", iconId: "cart" };

  test("normalizes the name and accepts a catalog icon", () => {
    expect(
      validateCategoryUpdate({ name: "  Groceries  ", iconId: "cart" }),
    ).toEqual({ ok: true, value: update });
  });

  test("rejects a blank name", () => {
    expect(validateCategoryUpdate({ ...update, name: "   " })).toEqual({
      ok: false,
      error: { code: "blank-name" },
    });
  });

  test("rejects a name beyond the shared bound", () => {
    expect(validateCategoryUpdate({ ...update, name: "x".repeat(61) })).toEqual(
      {
        ok: false,
        error: { code: "name-too-long" },
      },
    );
  });

  test("rejects an icon outside the shared catalog", () => {
    expect(
      validateCategoryUpdate({ ...update, iconId: "retired-glyph" }),
    ).toEqual({
      ok: false,
      error: { code: "unknown-icon" },
    });
  });
});
