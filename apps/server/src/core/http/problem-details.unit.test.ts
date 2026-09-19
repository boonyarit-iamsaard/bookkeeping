import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describe, expect, it } from "vitest";
import {
  idempotencyConflictProblem,
  idempotencyKeyRequiredProblem,
} from "./idempotency.js";
import type { ProblemCode, ProblemOptions } from "./problem-details.js";
import {
  createProblemDetails,
  getProblemOptionsForStatus,
  problemCodes,
  problemDetailsSchema,
} from "./problem-details.js";

/**
 * Every problem this API can answer with, by the source that owns it: a
 * status the transport maps, or an operation-specific problem a route
 * answers directly. The table is exhaustive over `ProblemCode`, so a new
 * code cannot be published without naming where it comes from.
 */
const problemSources: Record<ProblemCode, ProblemOptions> = {
  "bad-request": getProblemOptionsForStatus(400),
  unauthenticated: getProblemOptionsForStatus(401),
  forbidden: getProblemOptionsForStatus(403),
  "not-found": getProblemOptionsForStatus(404),
  "method-not-allowed": getProblemOptionsForStatus(405),
  conflict: getProblemOptionsForStatus(409),
  "invalid-command": getProblemOptionsForStatus(422),
  "rate-limited": getProblemOptionsForStatus(429),
  "internal-error": getProblemOptionsForStatus(500),
  "service-unavailable": getProblemOptionsForStatus(503),
  "idempotency-key-required": idempotencyKeyRequiredProblem,
  "idempotency-conflict": idempotencyConflictProblem,
};

const expectedStatuses: Record<ProblemCode, number> = {
  "bad-request": 400,
  unauthenticated: 401,
  forbidden: 403,
  "not-found": 404,
  "method-not-allowed": 405,
  conflict: 409,
  "invalid-command": 422,
  "rate-limited": 429,
  "internal-error": 500,
  "service-unavailable": 503,
  "idempotency-key-required": 400,
  "idempotency-conflict": 409,
};

describe("Problem Details variants", () => {
  it("names a source for every published problem code", () => {
    expect(Object.keys(problemSources).toSorted()).toEqual(
      [...problemCodes].toSorted(),
    );
  });

  it.for([...problemCodes])(
    "presents %s as a documented urn type at its own status",
    (code) => {
      const problem = createProblemDetails(problemSources[code]);

      expect(problem).toEqual(
        expect.objectContaining({
          type: `urn:bookkeeping:problem:${code}`,
          code,
          status: expectedStatuses[code],
          title: expect.any(String),
        }),
      );
      expect(problemDetailsSchema.parse(problem)).toEqual(problem);
    },
  );

  it("omits every optional member a caller does not supply", () => {
    const problem = createProblemDetails(getProblemOptionsForStatus(404));

    expect(Object.keys(problem).toSorted()).toEqual([
      "code",
      "status",
      "title",
      "type",
    ]);
  });

  it("carries occurrence prose, an instance, and typed domain details", () => {
    const problem = createProblemDetails({
      ...getProblemOptionsForStatus(409),
      detail: "Two refunds still point at this expense",
      instance: "/v1/transactions/0199",
      details: { refunds: 2 },
    });

    expect(problem).toEqual(
      expect.objectContaining({
        detail: "Two refunds still point at this expense",
        instance: "/v1/transactions/0199",
        details: { refunds: 2 },
      }),
    );
    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it("copies field errors addressed by JSON Pointer into a fresh array", () => {
    const errors = [{ pointer: "#/name", code: "blank-name" }] as const;
    const problem = createProblemDetails({
      ...getProblemOptionsForStatus(422),
      errors,
    });

    expect(problem.errors).toEqual([{ pointer: "#/name", code: "blank-name" }]);
    expect(problem.errors).not.toBe(errors);
    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it("falls back to a client or server problem for an unmapped status", () => {
    const statuses: ContentfulStatusCode[] = [418, 507];

    expect(statuses.map(getProblemOptionsForStatus)).toEqual([
      { code: "bad-request", status: 418, title: "Bad request" },
      { code: "internal-error", status: 507, title: "Internal server error" },
    ]);
  });
});
