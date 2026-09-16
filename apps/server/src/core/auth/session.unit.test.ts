import type { Session } from "@bookkeeping/auth/session";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  anonymousAuthGateway,
  createTestApp,
} from "../../testing/create-test-app.js";
import { problemDetailsSchema } from "../http/problem-details.js";
import type { AuthGateway } from "./auth.js";
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
    const app = createTestApp(signedInAuthGateway);
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
    const app = createTestApp(signedInAuthGateway);
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

  it("leaves health and auth routes outside the session requirement", async () => {
    const app = createTestApp(signedInAuthGateway);

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/api/auth/get-session")).status).toBe(404);
  });
});
