import type { ApiFieldError, ApiRejection } from "./write-submission";

/** The codes every feature answers alike, worded once for every screen. */
export type SharedRejectionCode = "unauthenticated" | "not-found";

const SHARED_MESSAGES: Record<SharedRejectionCode, string> = {
  unauthenticated: "Sign in again to continue.",
  "not-found":
    "This item no longer exists. It may have been deleted elsewhere.",
};

/** What the user reads beside a field whose code no wording module knows. */
export const FALLBACK_FIELD_MESSAGE = "This value was not accepted.";

function isSharedCode(code: string): code is SharedRejectionCode {
  return Object.hasOwn(SHARED_MESSAGES, code);
}

/** The shared wording for a problem code, or `undefined` for a feature's own. */
export function describeSharedRejection(code: string): string | undefined {
  return isSharedCode(code) ? SHARED_MESSAGES[code] : undefined;
}

/**
 * The error-bar message for a refused write: the shared wording when the whole
 * request was refused alike everywhere, else the rejection's own message.
 */
export function describeRejection(
  rejection: Readonly<ApiRejection>,
): string | undefined {
  return describeSharedRejection(rejection.problem.code) ?? rejection.message;
}

/**
 * A feature's field-error describer, from a table keyed by every code the API
 * publishes for it. Type the table with the published union so a new or
 * renamed code fails to compile; a code outside it reads the shared fallback.
 */
export function createFieldErrorDescriber<Code extends string>(
  messages: Readonly<Record<Code, string>>,
): (fieldError: Readonly<ApiFieldError>) => string {
  const isPublished = (code: string): code is Code =>
    Object.hasOwn(messages, code);
  return ({ code }) =>
    isPublished(code) ? messages[code] : FALLBACK_FIELD_MESSAGE;
}
