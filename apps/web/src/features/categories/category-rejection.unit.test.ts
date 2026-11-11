import { MAX_CATEGORY_NAME_LENGTH } from "@bookkeeping/domain/categories";
import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import type { ApiRejection } from "@/core/api/write-submission";
import {
  categoryFieldOf,
  describeCategoryFieldError,
  describeCategoryRejection,
} from "@/features/categories/category-rejection";

type CategoryRejectionCode =
  components["schemas"]["CategoryRuleFieldError"]["code"];
type CategoryBlockerCode =
  components["schemas"]["CategoryRemovalProblem"]["code"];

// Every field-error code the API publishes for a category; a new or renamed
// one fails to compile here until it is worded.
const EXPECTED_FIELD_MESSAGES: Record<CategoryRejectionCode, string> = {
  "blank-name": "Enter a name",
  "name-too-long": `Names can be at most ${MAX_CATEGORY_NAME_LENGTH} characters`,
  "unknown-icon": "Choose an icon from the catalog",
  "duplicate-name": "A category with this name already exists here.",
  "parent-not-found":
    "That parent is not available. Choose another or create one.",
  "parent-is-child":
    "A child category cannot hold children. Choose a parent category.",
  "parent-protected":
    "Uncategorized cannot hold children. Choose another parent.",
  protected: "Uncategorized keeps its name. Its icon can still change.",
};

// Every blocker code a removal can answer with.
const EXPECTED_BLOCKER_MESSAGES: Record<CategoryBlockerCode, string> = {
  protected:
    "Uncategorized cannot be removed. It is where removed parents' entries go.",
  "has-children":
    "Remove or rename its child categories first; a parent with children stays.",
  "in-use":
    "An entry was just recorded under this category. Nothing changed; try again.",
};

function rejection(code: string): ApiRejection {
  return {
    status: 409,
    problem: { status: 409, code, title: "Title" },
    errors: [],
    fieldErrors: {},
    message: "The problem's own words",
  };
}

describe("describeCategoryFieldError", () => {
  test.each(Object.entries(EXPECTED_FIELD_MESSAGES))(
    "words %s beside the name",
    (code, message) => {
      expect(
        describeCategoryFieldError({ field: "name", pointer: "#/name", code }),
      ).toBe(message);
    },
  );

  test.each(["#/parent", "#/parent/create/name"])(
    "points a duplicate name at %s to the existing parent",
    (pointer) => {
      expect(
        describeCategoryFieldError({
          field: "parent",
          pointer,
          code: "duplicate-name",
        }),
      ).toBe(
        "A category with this name already exists in this tree. Pick it as the parent instead.",
      );
    },
  );

  test("words an unpublished code with the shared fallback", () => {
    expect(
      describeCategoryFieldError({
        field: "name",
        pointer: "#/name",
        code: "renamed-code",
      }),
    ).toBe("This value was not accepted.");
  });
});

describe("describeCategoryRejection", () => {
  test.each(Object.entries(EXPECTED_BLOCKER_MESSAGES))(
    "words the %s blocker",
    (code, message) => {
      expect(describeCategoryRejection(rejection(code))).toBe(message);
    },
  );

  test("words the codes every feature shares in the shared voice", () => {
    expect(describeCategoryRejection(rejection("not-found"))).toBe(
      "This item no longer exists. It may have been deleted elsewhere.",
    );
    expect(describeCategoryRejection(rejection("unauthenticated"))).toBe(
      "Sign in again to continue.",
    );
  });

  test("leaves any other problem to its own message", () => {
    expect(describeCategoryRejection(rejection("conflict"))).toBe(
      "The problem's own words",
    );
  });
});

describe("categoryFieldOf", () => {
  test.each([
    ["#/name", "name"],
    ["#/iconId", "iconId"],
    ["#/parent", "parent"],
    ["#/parent/create/name", "parentName"],
    ["#/parent/create/iconId", "parentIconId"],
  ])("reads %s back as the %s field", (pointer, field) => {
    expect(categoryFieldOf(pointer)).toBe(field);
  });

  test("claims no field for a pointer the form does not show", () => {
    expect(categoryFieldOf("#/kind")).toBeUndefined();
  });
});
