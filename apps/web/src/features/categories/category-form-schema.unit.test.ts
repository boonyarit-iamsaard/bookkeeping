import { describe, expect, test } from "vitest";
import {
  categoryFormSchema,
  toCreateCategorySubmission,
} from "./category-form-schema";

const parentInput = {
  name: "Drinks",
  iconId: "beer",
  parent: "",
  parentName: "",
  parentIconId: "generic",
};

describe("category creation form", () => {
  test("trims the name and rejects a blank one", () => {
    const parsed = categoryFormSchema.safeParse({
      ...parentInput,
      name: "  Drinks ",
    });
    expect(parsed.success && parsed.data.name).toBe("Drinks");
    const blank = categoryFormSchema.safeParse({ ...parentInput, name: "   " });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0]?.path).toEqual(["name"]);
  });

  test("a new parent needs its own name only when 'new' is chosen", () => {
    expect(
      categoryFormSchema.safeParse({ ...parentInput, parent: "new" }).success,
    ).toBe(false);
    expect(
      categoryFormSchema.safeParse({
        ...parentInput,
        parent: "new",
        parentName: " Going out ",
      }).success,
    ).toBe(true);
  });

  test("the submission names the parent choice explicitly", () => {
    expect(toCreateCategorySubmission("expense", parentInput)).toEqual({
      kind: "expense",
      name: "Drinks",
      iconId: "beer",
      parent: null,
    });
    expect(
      toCreateCategorySubmission("expense", {
        ...parentInput,
        parent: "abc",
      }).parent,
    ).toEqual({ existingId: "abc" });
    expect(
      toCreateCategorySubmission("expense", {
        ...parentInput,
        parent: "new",
        parentName: " Going out ",
        parentIconId: "party",
      }).parent,
    ).toEqual({ create: { name: "Going out", iconId: "party" } });
  });
});
