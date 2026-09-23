import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import {
  TEST_API_ORIGIN as API_ORIGIN,
  createIntegrationTestApp,
  createUniqueTestEmail,
  TEST_PASSWORD as PASSWORD,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { API_COOKIE_PREFIX } from "./gateway.js";
import type { AuthenticatedEnv } from "./session.js";

const { withRollback } = setupTestDatabase();

const WEB_ORIGIN = TEST_CLIENT_ORIGIN;
const API_COOKIE_NAME = `${API_COOKIE_PREFIX}.session_token`;

/** The mounted app plus a protected probe route. */
function createSessionProbeApp(db: Database) {
  const app = createIntegrationTestApp(db);
  app.route(
    "/v1",
    new Hono<AuthenticatedEnv>().get("/whoami", (c) =>
      c.json({ userId: c.get("session").user.id }),
    ),
  );
  return app;
}

interface SignUpRequest {
  origin?: string;
  email: string;
  headers?: Record<string, string>;
}

function signUpRequest({ origin, email, headers }: Readonly<SignUpRequest>) {
  return new Request(`${API_ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin === undefined ? {} : { origin }),
      ...headers,
    },
    body: JSON.stringify({ name: "Hono user", email, password: PASSWORD }),
  });
}

describe("Better Auth mounted in Hono", () => {
  test("a browser on a client origin signs up and receives a host-only, HTTP-only API cookie", async () => {
    await withRollback(async (db) => {
      const app = createSessionProbeApp(db);

      const response = await app.request(
        signUpRequest({
          origin: WEB_ORIGIN,
          email: createUniqueTestEmail("hono"),
        }),
      );
      const cookie = response.headers.get("set-cookie") ?? "";

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        WEB_ORIGIN,
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      expect(cookie).toContain(`${API_COOKIE_NAME}=`);
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*Path=\//i);
      expect(cookie).not.toMatch(/;\s*Domain=/i);
    });
  });

  test("the issued cookie authenticates protected routes; a missing or forged one does not", async () => {
    await withRollback(async (db) => {
      const app = createSessionProbeApp(db);
      const signUp = await app.request(
        signUpRequest({
          origin: WEB_ORIGIN,
          email: createUniqueTestEmail("hono"),
        }),
      );
      const cookie = signUp.headers.get("set-cookie") ?? "";

      const authenticated = await app.request(`${API_ORIGIN}/v1/whoami`, {
        headers: { cookie, origin: WEB_ORIGIN },
      });
      const anonymous = await app.request(`${API_ORIGIN}/v1/whoami`, {
        headers: { origin: WEB_ORIGIN },
      });
      const forged = await app.request(`${API_ORIGIN}/v1/whoami`, {
        headers: { cookie: `${API_COOKIE_NAME}=not-a-real-token` },
      });

      expect(authenticated.status).toBe(200);
      expect(await authenticated.json()).toEqual({
        userId: expect.any(String),
      });
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get("content-type")).toBe(
        "application/problem+json",
      );
      expect(forged.status).toBe(401);
    });
  });

  test("Better Auth rejects sign-up from an untrusted browser origin", async () => {
    await withRollback(async (db) => {
      const app = createSessionProbeApp(db);

      const response = await app.request(
        signUpRequest({
          origin: "https://evil.example",
          email: createUniqueTestEmail("hono"),
        }),
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  test("Better Auth rejects a cross-site navigation sign-in as CSRF", async () => {
    await withRollback(async (db) => {
      const app = createSessionProbeApp(db);

      const response = await app.request(
        signUpRequest({
          email: createUniqueTestEmail("hono"),
          headers: {
            "sec-fetch-site": "cross-site",
            "sec-fetch-mode": "navigate",
          },
        }),
      );

      expect(response.status).toBe(403);
    });
  });
});
