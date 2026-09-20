import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as z from "zod";

export const PROBLEM_MEDIA_TYPE = "application/problem+json";

export const problemCodes = [
  "bad-request",
  "conflict",
  "forbidden",
  "has-children",
  "history-remains",
  "idempotency-conflict",
  "idempotency-key-required",
  "in-use",
  "internal-error",
  "invalid-command",
  "method-not-allowed",
  "not-found",
  "protected",
  "rate-limited",
  "refunds-exist",
  "service-unavailable",
  "unauthenticated",
] as const;

export type ProblemCode = (typeof problemCodes)[number];

export const problemCodeSchema = z.enum(problemCodes);

export const problemFieldErrorSchema = z
  .object({
    pointer: z.string(),
    code: z.string(),
    detail: z.string().optional(),
  })
  .meta({ id: "ProblemFieldError" });

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    code: problemCodeSchema,
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z.array(problemFieldErrorSchema).optional(),
  })
  // RFC 9457 extension members: a problem may carry the state that caused
  // it beside its code, documented by that problem's own schema variant.
  .loose()
  .meta({ id: "ProblemDetails" });

export interface ProblemFieldError {
  pointer: string;
  code: string;
  detail?: string;
}

export interface ProblemDetails
  extends Omit<ProblemOptions, "errors" | "extensions"> {
  type: string;
  /** A fresh array: the body is JSON output, never the caller's list. */
  errors?: ProblemFieldError[];
  [extension: string]: unknown;
}

/**
 * The status is generic so a caller answering a described handler keeps the
 * literal it documented; the default covers callers that answer any status.
 */
export interface ProblemOptions<
  Status extends ContentfulStatusCode = ContentfulStatusCode,
> {
  code: ProblemCode;
  status: Status;
  title: string;
  detail?: string;
  instance?: string;
  errors?: readonly ProblemFieldError[];
  /** Extension members presented beside the standard ones; JSON-ready values only. */
  extensions?: Readonly<Record<string, unknown>>;
}

interface StandardProblem {
  code: ProblemCode;
  title: string;
}

const standardProblems: Partial<Record<ContentfulStatusCode, StandardProblem>> =
  {
    400: { code: "bad-request", title: "Bad request" },
    401: { code: "unauthenticated", title: "Authentication required" },
    403: { code: "forbidden", title: "Forbidden" },
    404: { code: "not-found", title: "Resource not found" },
    405: { code: "method-not-allowed", title: "Method not allowed" },
    409: { code: "conflict", title: "Resource conflict" },
    422: { code: "invalid-command", title: "Command is invalid" },
    429: { code: "rate-limited", title: "Too many requests" },
    500: { code: "internal-error", title: "Internal server error" },
    503: { code: "service-unavailable", title: "Service unavailable" },
  };

export function createProblemDetails(
  options: Readonly<ProblemOptions>,
): ProblemDetails {
  return {
    ...options.extensions,
    type: `urn:bookkeeping:problem:${options.code}`,
    title: options.title,
    status: options.status,
    code: options.code,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
    ...(options.instance === undefined ? {} : { instance: options.instance }),
    ...(options.errors === undefined ? {} : { errors: [...options.errors] }),
  };
}

/**
 * The return type stays inferred: the response is typed by the literal
 * status, which is what lets a described handler's response union accept it.
 */
export function createProblemResponse<Status extends ContentfulStatusCode>(
  c: Context,
  options: Readonly<ProblemOptions<Status>>,
) {
  return c.json(createProblemDetails(options), options.status, {
    "Content-Type": PROBLEM_MEDIA_TYPE,
  });
}

export function getProblemOptionsForStatus<Status extends ContentfulStatusCode>(
  status: Status,
): ProblemOptions<Status> {
  const standardProblem = standardProblems[status];

  if (standardProblem !== undefined) {
    return { ...standardProblem, status };
  }

  return {
    code: status >= 500 ? "internal-error" : "bad-request",
    status,
    title: status >= 500 ? "Internal server error" : "Bad request",
  };
}
