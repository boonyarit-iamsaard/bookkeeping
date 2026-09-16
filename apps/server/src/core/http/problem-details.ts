import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as z from "zod";

export const PROBLEM_MEDIA_TYPE = "application/problem+json";

export const problemCodes = [
  "bad-request",
  "conflict",
  "forbidden",
  "internal-error",
  "invalid-command",
  "method-not-allowed",
  "not-found",
  "rate-limited",
  "service-unavailable",
  "unauthenticated",
] as const;

export type ProblemCode = (typeof problemCodes)[number];

export const problemCodeSchema = z.enum(problemCodes);

export const problemFieldErrorSchema = z.object({
  pointer: z.string(),
  code: z.string(),
  detail: z.string().optional(),
});

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    code: problemCodeSchema,
    detail: z.string().optional(),
    instance: z.string().optional(),
    details: z.unknown().optional(),
    errors: z.array(problemFieldErrorSchema).optional(),
  })
  .loose();

export interface ProblemFieldError {
  pointer: string;
  code: string;
  detail?: string;
}

export interface ProblemDetails extends ProblemOptions {
  type: string;
}

export interface ProblemOptions {
  code: ProblemCode;
  status: ContentfulStatusCode;
  title: string;
  detail?: string;
  instance?: string;
  details?: unknown;
  errors?: readonly ProblemFieldError[];
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
    type: `urn:bookkeeping:problem:${options.code}`,
    title: options.title,
    status: options.status,
    code: options.code,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
    ...(options.instance === undefined ? {} : { instance: options.instance }),
    ...(options.details === undefined ? {} : { details: options.details }),
    ...(options.errors === undefined ? {} : { errors: options.errors }),
  };
}

export function problemResponse(
  c: Context,
  options: Readonly<ProblemOptions>,
): Response {
  return c.json(createProblemDetails(options), options.status, {
    "Content-Type": PROBLEM_MEDIA_TYPE,
  });
}

export function problemForStatus(status: ContentfulStatusCode): ProblemOptions {
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
