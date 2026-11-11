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
      error: {
        code: "rejected",
        rejections: [{ code: "unknown-icon", field: "iconId" }],
      },
    });
  });

  test("addresses a refused new parent by the parent's own fields", () => {
    function attempt(create: { name: string; iconId: string }) {
      return validateCategoryCreation({ ...command, parent: { create } });
    }

    expect(attempt({ name: "  ", iconId: "beer" })).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "blank-name", field: "parentName" }],
      },
    });
    expect(attempt({ name: "x".repeat(61), iconId: "beer" })).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "name-too-long", field: "parentName" }],
      },
    });
    expect(attempt({ name: "Drinks", iconId: "retired-glyph" })).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "unknown-icon", field: "parentIconId" }],
      },
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
      error: {
        code: "rejected",
        rejections: [{ code: "blank-name", field: "name" }],
      },
    });
  });

  test("rejects a name beyond the shared bound", () => {
    expect(validateCategoryUpdate({ ...update, name: "x".repeat(61) })).toEqual(
      {
        ok: false,
        error: {
          code: "rejected",
          rejections: [{ code: "name-too-long", field: "name" }],
        },
      },
    );
  });

  test("rejects an icon outside the shared catalog", () => {
    expect(
      validateCategoryUpdate({ ...update, iconId: "retired-glyph" }),
    ).toEqual({
      ok: false,
      error: {
        code: "rejected",
        rejections: [{ code: "unknown-icon", field: "iconId" }],
      },
    });
  });
});
