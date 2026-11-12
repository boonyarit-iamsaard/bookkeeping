import type { Session } from "@bookkeeping/auth/session";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  anonymousAuthGateway,
  createUnitTestApp,
} from "../../testing/create-unit-test-app.js";
import { problemDetailsSchema } from "../http/problem-details.js";
import type { AuthGateway } from "./gateway.js";
import type { AuthenticatedEnv } from "./session.js";

const session: Session = {
  id: "session-1",
  expiresAt: new Date("2030-01-01T00:00:00Z"),
  user: { id: "user-1", email: "owner@test.local", name: "Owner" },
};

const signedInAuthGateway: AuthGateway = {
  ...anonymousAuthGateway,
  async resolveSession(headers) {
    return headers.get("cookie") === "api-session=valid" ? session : null;
  },
};

describe("requireSession", () => {
  it("returns an unauthenticated problem without a session", async () => {
    const app = createUnitTestApp({ auth: signedInAuthGateway });
    app.get("/v1/whoami", (c) => c.json({ ok: true }));

    const response = await app.request("/v1/whoami");
    const problem = problemDetailsSchema.parse(await response.json());

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(problem).toEqual({
      type: "urn:bookkeeping:problem:unauthenticated",
      title: "Authentication required",
      status: 401,
      code: "unauthenticated",
    });
  });

  it("resolves the session into request context for the route", async () => {
    const app = createUnitTestApp({ auth: signedInAuthGateway });
    const whoamiRoutes = new Hono<AuthenticatedEnv>().get("/whoami", (c) =>
      c.json({ userId: c.get("session").user.id }),
    );
    app.route("/v1", whoamiRoutes);

    const response = await app.request("/v1/whoami", {
      headers: { cookie: "api-session=valid" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "user-1" });
  });

  it("answers every route outside the public ones unauthenticated without a session", async () => {
    const app = createUnitTestApp();
    const publicPaths = new Set(["/health", "/sign-up", "/openapi.json"]);
    const protectedRoutes = new Set(
      app.routes
        .filter(
          (route) =>
            route.method !== "ALL" &&
            !publicPaths.has(route.path) &&
            !route.path.startsWith("/api/auth/"),
        )
        .map((route) => `${route.method} ${route.path}`),
    );
    expect(protectedRoutes.size).toBeGreaterThan(0);

    for (const route of protectedRoutes) {
      const [method, path] = route.split(" ");
      const response = await app.request(
        path.replaceAll(/:\w+/g, "01999999-0000-7000-8000-000000000000"),
        { method },
      );
      const problem = problemDetailsSchema.parse(await response.json());
      expect({ route, status: response.status, code: problem.code }).toEqual({
        route,
        status: 401,
        code: "unauthenticated",
      });
    }
  });

  it("leaves health and auth routes outside the session requirement", async () => {
    const app = createUnitTestApp({ auth: signedInAuthGateway });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/api/auth/get-session")).status).toBe(404);
  });
});
