import type { ContentfulStatusCode } from "hono/utils/http-status";
import { describe, expect, it } from "vitest";
import { categoryRemovalProblems } from "../../features/categories/category.routes.js";
import { refundsExistProblem } from "../../features/transactions/transaction.routes.js";
import { historyRemainsProblem } from "../../features/wallets/wallet.routes.js";
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
interface ProblemSource {
  options: ProblemOptions;
  status: number;
}

const problemSources: Record<ProblemCode, ProblemSource> = {
  "bad-request": { options: getProblemOptionsForStatus(400), status: 400 },
  unauthenticated: { options: getProblemOptionsForStatus(401), status: 401 },
  forbidden: { options: getProblemOptionsForStatus(403), status: 403 },
  "not-found": { options: getProblemOptionsForStatus(404), status: 404 },
  "method-not-allowed": {
    options: getProblemOptionsForStatus(405),
    status: 405,
  },
  conflict: { options: getProblemOptionsForStatus(409), status: 409 },
  "invalid-command": { options: getProblemOptionsForStatus(422), status: 422 },
  "rate-limited": { options: getProblemOptionsForStatus(429), status: 429 },
  "internal-error": { options: getProblemOptionsForStatus(500), status: 500 },
  "service-unavailable": {
    options: getProblemOptionsForStatus(503),
    status: 503,
  },
  "idempotency-key-required": {
    options: idempotencyKeyRequiredProblem,
    status: 400,
  },
  "idempotency-conflict": { options: idempotencyConflictProblem, status: 409 },
  "refunds-exist": { options: refundsExistProblem, status: 409 },
  "history-remains": { options: historyRemainsProblem, status: 409 },
  protected: { options: categoryRemovalProblems.protected, status: 409 },
  "has-children": {
    options: categoryRemovalProblems["has-children"],
    status: 409,
  },
  "in-use": { options: categoryRemovalProblems["in-use"], status: 409 },
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
      const problem = createProblemDetails(problemSources[code].options);

      expect(problem).toEqual(
        expect.objectContaining({
          type: `urn:bookkeeping:problem:${code}`,
          code,
          status: problemSources[code].status,
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

  it("carries occurrence prose, an instance, and extension members beside the standard ones", () => {
    const problem = createProblemDetails({
      ...refundsExistProblem,
      detail: "Two refunds still point at this expense",
      instance: "/v1/transactions/0199",
      extensions: { refunds: [{ id: "0199" }], code: "not-this-one" },
    });

    expect(problem).toEqual(
      expect.objectContaining({
        code: "refunds-exist",
        detail: "Two refunds still point at this expense",
        instance: "/v1/transactions/0199",
        refunds: [{ id: "0199" }],
      }),
    );
    expect(problem).not.toHaveProperty("extensions");
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
