import { MAX_TAG_NAME_LENGTH } from "@bookkeeping/domain/tags";
import type { ApiFieldError, ApiRejection } from "@/core/api/write-submission";

const NAME_MESSAGES: Record<string, string> = {
  "blank-name": "Enter a name for the tag.",
  "name-too-long": `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.`,
  "duplicate-name": "A tag with this name already exists.",
};

export const TAG_CONNECTION_MESSAGE =
  "The change could not be confirmed. Check your connection and try again.";

export const TAG_GONE_MESSAGE =
  "This tag no longer exists. It may have been merged or deleted elsewhere.";

/** The message beside a refused tag name, in the product's words. */
export function describeTagNameError({
  code,
  detail,
}: Readonly<ApiFieldError>): string {
  return NAME_MESSAGES[code] ?? detail ?? "This name was not accepted.";
}

/** The form-level message for a refused tag write. */
export function describeTagRejection(
  rejection: Readonly<ApiRejection>,
): string | undefined {
  if (rejection.problem.code === "not-found") {
    return TAG_GONE_MESSAGE;
  }
  if (rejection.problem.code === "unauthenticated") {
    return "Sign in again to manage tags.";
  }
  return rejection.message;
}
