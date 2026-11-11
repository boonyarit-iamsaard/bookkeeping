import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import type { components } from "@/core/api/openapi.gen";
import { createFieldErrorDescriber } from "@/core/api/rejection-wording";

/** Every reason the API refuses a tag name, as it publishes them. */
export type TagRejectionCode =
  components["schemas"]["TagRuleFieldError"]["code"];

// Keyed by every published code, so a new or renamed one fails to compile
// until it has a message.
const TAG_MESSAGES: Record<TagRejectionCode, string> = {
  "blank-name": "Enter a name for the tag.",
  "name-too-long": `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.`,
  "duplicate-name": "A tag with this name already exists.",
};

/** The message beside a refused tag name, in the product's words. */
export const describeTagFieldError = createFieldErrorDescriber(TAG_MESSAGES);
