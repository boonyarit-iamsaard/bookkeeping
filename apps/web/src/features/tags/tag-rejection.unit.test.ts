import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import type { ApiRejection } from "@/core/api/write-submission";
import {
  describeTagFieldError,
  TAG_REFUSAL_WORDING,
} from "@/features/tags/tag-rejection";

type TagRejectionCode = components["schemas"]["TagRuleFieldError"]["code"];

// Every code the API publishes for a tag; a new or renamed one fails to
// compile here until it is worded.
const EXPECTED_MESSAGES: Record<TagRejectionCode, string> = {
  "blank-name": "Enter a name for the tag.",
  "name-too-long": `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.`,
  "duplicate-name": "A tag with this name already exists.",
};

describe("describeTagFieldError", () => {
  test.each(Object.entries(EXPECTED_MESSAGES))(
    "words %s beside the name",
    (code, message) => {
      expect(
        describeTagFieldError({ field: "name", pointer: "#/name", code }),
      ).toBe(message);
    },
  );
});

// The codes every feature answers alike, as an independent literal.
const SHARED_MESSAGES = {
  unauthenticated: "Sign in again to continue.",
  "not-found":
    "This item no longer exists. It may have been deleted elsewhere.",
};

function refusal(code: string): ApiRejection {
  return {
    status: 409,
    problem: { status: 409, code, title: "Title" },
    errors: [],
    fieldErrors: {},
    message: "The problem's own words",
  };
}

// Every tag write, the create picker included, declares this wording, so the
// whole request refused alike everywhere reads the same on every screen.
describe("TAG_REFUSAL_WORDING", () => {
  test.each(Object.entries(SHARED_MESSAGES))(
    "words %s in the shared voice",
    (code, message) => {
      expect(TAG_REFUSAL_WORDING.describeRejection(refusal(code))).toBe(
        message,
      );
    },
  );

  test("leaves any other problem to its own message", () => {
    expect(TAG_REFUSAL_WORDING.describeRejection(refusal("conflict"))).toBe(
      "The problem's own words",
    );
  });

  test("words a field error with the tag wording", () => {
    expect(
      TAG_REFUSAL_WORDING.describeFieldError({
        field: "name",
        pointer: "#/name",
        code: "blank-name",
      }),
    ).toBe("Enter a name for the tag.");
  });
});
