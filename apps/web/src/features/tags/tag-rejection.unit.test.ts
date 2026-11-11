import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import { describe, expect, test } from "vitest";
import type { components } from "@/core/api/openapi.gen";
import { describeTagFieldError } from "@/features/tags/tag-rejection";

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
