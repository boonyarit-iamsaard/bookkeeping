import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "../features/health/health.routes.js";
import { problemDetailsSchema } from "./http/problem-details.js";
import { createTestApp } from "./testing/create-test-app.js";

const requestIdHeader = "X-Request-Id";

describe("HTTP contract", () => {
  it("returns direct JSON success bodies with fresh request identifiers", async () => {
    const app = createTestApp();

    const firstResponse = await app.request("/health");
    const secondResponse = await app.request("/health");

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get("content-type")).toContain(
      "application/json",
    );
    expect(healthResponseSchema.parse(await firstResponse.json())).toEqual({
      status: "ok",
    });

    const firstRequestId = firstResponse.headers.get(requestIdHeader);
    const secondRequestId = secondResponse.headers.get(requestIdHeader);

    expect(firstRequestId).toBeTruthy();
    expect(secondRequestId).toBeTruthy();
    expect(firstRequestId).not.toBe(secondRequestId);
  });

  it("does not trust a client-supplied request identifier", async () => {
    const response = await createTestApp().request("/health", {
      headers: { [requestIdHeader]: "client-supplied-id" },
    });

    expect(response.headers.get(requestIdHeader)).toBeTruthy();
    expect(response.headers.get(requestIdHeader)).not.toBe(
      "client-supplied-id",
    );
  });

  it("makes the request identifier available to request-scoped logging", async () => {
    const app = createTestApp();
    let loggedRequestId: string | undefined;

    app.get("/request-context", (c) => {
      loggedRequestId = c.get("requestId");
      return c.json({ status: "ok" });
    });

    const response = await app.request("/request-context");

    expect(response.status).toBe(200);
    expect(loggedRequestId).toBe(response.headers.get(requestIdHeader));
  });

  it("adds request identifiers to bodyless responses", async () => {
    const app = createTestApp();
    app.delete("/bodyless", (c) => c.body(null, 204));

    const response = await app.request("/bodyless", { method: "DELETE" });

    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get(requestIdHeader)).toBeTruthy();
  });

  it("maps HTTP exceptions to stable Problem Details", async () => {
    const app = createTestApp();
    app.get("/conflict", () => {
      throw new HTTPException(409, { message: "private conflict detail" });
    });

    const response = await app.request("/conflict");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(problem).toEqual({
      type: "urn:bookkeeping:problem:conflict",
      title: "Resource conflict",
      status: 409,
      code: "conflict",
    });
    expect(response.headers.get(requestIdHeader)).toBeTruthy();
  });

  it("returns not-found failures as Problem Details", async () => {
    const response = await createTestApp().request("/missing");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(problem).toEqual({
      type: "urn:bookkeeping:problem:not-found",
      title: "Resource not found",
      status: 404,
      code: "not-found",
    });
    expect(response.headers.get(requestIdHeader)).toBeTruthy();
  });

  it("returns unexpected faults as opaque internal-error problems", async () => {
    const app = createTestApp();
    app.get("/unexpected-fault", () => {
      throw new Error("database password should never reach the client");
    });

    const response = await app.request("/unexpected-fault");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(problem).toEqual({
      type: "urn:bookkeeping:problem:internal-error",
      title: "Internal server error",
      status: 500,
      code: "internal-error",
    });
    expect(response.headers.get(requestIdHeader)).toBeTruthy();
  });

  it("returns an opaque internal-error problem for non-Error faults", async () => {
    const app = createTestApp();
    app.get("/unexpected-value", () => {
      throw { secret: "must never reach the client" };
    });

    const response = await app.request("/unexpected-value");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(problem).toEqual({
      type: "urn:bookkeeping:problem:internal-error",
      title: "Internal server error",
      status: 500,
      code: "internal-error",
    });
    expect(response.headers.get(requestIdHeader)).toBeTruthy();
  });
});
