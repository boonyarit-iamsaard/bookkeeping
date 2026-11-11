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

/**
 * A feature's error-bar describer for the blockers it publishes, from a table
 * keyed by every blocker code. A shared code reads its shared wording; any
 * other problem reads its own message.
 */
export function createBlockerDescriber<Code extends string>(
  messages: Readonly<Record<Code, string>>,
): (rejection: Readonly<ApiRejection>) => string | undefined {
  const isPublished = (code: string): code is Code =>
    Object.hasOwn(messages, code);
  return (rejection) => {
    const { code } = rejection.problem;
    return isPublished(code) ? messages[code] : describeRejection(rejection);
  };
}

interface FactualDescriberOptions<Code extends string, Facts> {
  /** The message of every published code that names no fact. */
  plain: Readonly<Record<Exclude<Code, keyof Facts>, string>>;
  /** The message of every code that names facts, built from them. */
  factual: { readonly [C in keyof Facts & Code]: (facts: Facts[C]) => string };
  /**
   * The facts a field error carries for a factual code, parsed rather than
   * trusted, or `undefined` when they are missing or malformed.
   */
  readFacts: <C extends keyof Facts & Code>(
    code: C,
    fieldError: Readonly<ApiFieldError>,
  ) => Facts[C] | undefined;
}

/**
 * A feature's field-error describer when some of its messages name facts:
 * plain codes read a string, factual codes read a function of the facts
 * parsed off the field error. `Facts` maps each factual code to its facts. A
 * code outside the table, or a factual code whose facts did not arrive, reads
 * the shared fallback.
 */
export function createFactualFieldErrorDescriber<
  Code extends string,
  Facts extends { [C in Code]?: object },
>({
  plain,
  factual,
  readFacts,
}: Readonly<FactualDescriberOptions<Code, Facts>>): (
  fieldError: Readonly<ApiFieldError>,
) => string {
  const isFactual = (code: string): code is keyof Facts & Code =>
    Object.hasOwn(factual, code);
  const isPlain = (code: string): code is Exclude<Code, keyof Facts> =>
    Object.hasOwn(plain, code);

  return (fieldError) => {
    const { code } = fieldError;
    if (isPlain(code)) {
      return plain[code];
    }
    if (!isFactual(code)) {
      return FALLBACK_FIELD_MESSAGE;
    }
    const facts = readFacts(code, fieldError);
    return facts === undefined ? FALLBACK_FIELD_MESSAGE : factual[code](facts);
  };
}
