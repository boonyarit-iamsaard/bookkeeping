import * as z from "zod";
import type { ProblemFieldError, ProblemOptions } from "./problem-details.js";
import { getProblemOptionsForStatus } from "./problem-details.js";

/** A Standard Schema issue as the validator hook reports it. */
export interface ValidationIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
}

// What Zod adds to an issue: its own code, and for a custom issue the code
// the schema author chose through `params`. Parsed rather than trusted.
const issueDetailsSchema = z.object({
  code: z.string().optional(),
  params: z.object({ code: z.string().optional() }).optional(),
});

function toPathKey(segment: PropertyKey | { readonly key: PropertyKey }) {
  return typeof segment === "object" ? segment.key : segment;
}

/** RFC 6901: "~" and "/" inside a segment become "~0" and "~1". */
function toJsonPointer(issue: ValidationIssue): string {
  const segments = (issue.path ?? []).map((segment) =>
    String(toPathKey(segment)).replaceAll("~", "~0").replaceAll("/", "~1"),
  );
  return `#/${segments.join("/")}`;
}

/**
 * A custom issue names its own code; any other issue carries the schema
 * library's code in kebab case. An issue that reports neither is `invalid`.
 */
function toFieldErrorCode(issue: ValidationIssue): string {
  const details = issueDetailsSchema.safeParse(issue);
  if (!details.success || details.data.code === undefined) {
    return "invalid";
  }
  if (details.data.code === "custom") {
    return details.data.params?.code ?? "invalid";
  }
  return details.data.code.replaceAll("_", "-");
}

export function toFieldError(issue: ValidationIssue): ProblemFieldError {
  return { pointer: toJsonPointer(issue), code: toFieldErrorCode(issue) };
}

/**
 * One 422 problem for a well-formed command the schema rejects, addressing
 * each field by JSON Pointer into the request document so a client can attach
 * the failure to the right input without reading prose.
 */
export function createInvalidCommandProblem(
  issues: readonly ValidationIssue[],
): ProblemOptions {
  return {
    ...getProblemOptionsForStatus(422),
    errors: issues.map(toFieldError),
  };
}
