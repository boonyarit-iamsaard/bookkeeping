import { createAuth } from "@bookkeeping/auth/config";
import { resolveSession } from "@bookkeeping/auth/session";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-test-app.js";
import { createApp } from "../app.js";
import { API_COOKIE_PREFIX, createAuthGateway } from "./auth.js";
import type { AuthenticatedEnv } from "./session.js";

const { withRollback } = setupTestDatabase();

const TEST_SECRET = "integration-test-secret-with-at-least-32-chars";
const API_ORIGIN = "http://localhost:5000";
const WEB_ORIGIN = TEST_CLIENT_ORIGIN;
const API_COOKIE_NAME = `${API_COOKIE_PREFIX}.session_token`;
const WEB_COOKIE_NAME = "better-auth.session_token";
const PASSWORD = "correct horse battery";

function uniqueEmail(): string {
  return `hono-${process.pid}-${Date.now()}@test.local`;
}

/** The Hono mount as the entrypoint assembles it, over the given database. */
function createHonoApp(db: Database) {
  const auth = createAuth({
    db,
    secret: TEST_SECRET,
    baseURL: API_ORIGIN,
    trustedOrigins: [WEB_ORIGIN],
    cookiePrefix: API_COOKIE_PREFIX,
  });
  const app = createApp({
    auth: createAuthGateway(auth),
    clientOrigins: [WEB_ORIGIN],
  });
  app.route(
    "/v1",
    new Hono<AuthenticatedEnv>().get("/whoami", (c) =>
      c.json({ userId: c.get("session").user.id }),
    ),
  );
  return app;
}

/** The temporary Next.js mount: same store and secret, its own origin. */
function createWebAuth(db: Database) {
  return createAuth({ db, secret: TEST_SECRET, baseURL: WEB_ORIGIN });
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
      const app = createHonoApp(db);

      const response = await app.request(
        signUpRequest({ origin: WEB_ORIGIN, email: uniqueEmail() }),
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
      const app = createHonoApp(db);
      const signUp = await app.request(
        signUpRequest({ origin: WEB_ORIGIN, email: uniqueEmail() }),
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
      const app = createHonoApp(db);

      const response = await app.request(
        signUpRequest({ origin: "https://evil.example", email: uniqueEmail() }),
      );

      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  test("Better Auth rejects a cross-site navigation sign-in as CSRF", async () => {
    await withRollback(async (db) => {
      const app = createHonoApp(db);

      const response = await app.request(
        signUpRequest({
          email: uniqueEmail(),
          headers: {
            "sec-fetch-site": "cross-site",
            "sec-fetch-mode": "navigate",
          },
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  test("the Next.js and Hono mounts issue separate cookies over one user store", async () => {
    await withRollback(async (db) => {
      const app = createHonoApp(db);
      const webAuth = createWebAuth(db);
      const email = uniqueEmail();

      const honoSignUp = await app.request(
        signUpRequest({ origin: WEB_ORIGIN, email }),
      );
      const honoCookie = honoSignUp.headers.get("set-cookie") ?? "";
      const honoWhoami = await app.request(`${API_ORIGIN}/v1/whoami`, {
        headers: { cookie: honoCookie },
      });
      const { userId } = await honoWhoami.json();

      // The user Hono created signs in through the Next.js mount because both
      // read the same user store...
      const webSignIn = await webAuth.api.signInEmail({
        body: { email, password: PASSWORD },
        returnHeaders: true,
      });
      const webCookie = webSignIn.headers.get("set-cookie") ?? "";
      const webSession = await resolveSession(
        webAuth,
        new Headers({ cookie: webCookie }),
      );
      expect(webSession?.user.id).toBe(userId);

      // ...but each mount names its own cookie and ignores the other's, even
      // when both share one hostname in local development.
      expect(honoCookie).toContain(`${API_COOKIE_NAME}=`);
      expect(webCookie).toContain(`${WEB_COOKIE_NAME}=`);
      expect(
        await resolveSession(webAuth, new Headers({ cookie: honoCookie })),
      ).toBeNull();
      const webCookieAtHono = await app.request(`${API_ORIGIN}/v1/whoami`, {
        headers: { cookie: webCookie },
      });
      expect(webCookieAtHono.status).toBe(401);
    });
  });
});
