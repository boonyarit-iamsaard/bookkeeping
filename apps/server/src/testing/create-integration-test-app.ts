import { createAuth } from "@bookkeeping/auth/config";
import type { Database } from "@bookkeeping/database/connection";
import type { Hono } from "hono";
import { createApp } from "../core/app.js";
import { API_COOKIE_PREFIX, createAuthGateway } from "../core/auth/gateway.js";
import type { AppEnv } from "../core/http/request-context.js";
import { TEST_CLIENT_ORIGIN } from "./create-unit-test-app.js";

export const TEST_AUTH_SECRET =
  "integration-test-secret-with-at-least-32-chars";
export const TEST_API_ORIGIN = "http://localhost:5000";
export const TEST_PASSWORD = "correct horse battery";

let emailSequence = 0;

export function createUniqueTestEmail(label: string): string {
  emailSequence += 1;
  return `${label}-${process.pid}-${Date.now()}-${emailSequence}@test.local`;
}

/**
 * The server app as the entrypoint assembles it — real authentication over the
 * given database — trusting the test client origin.
 */
export function createIntegrationTestApp(db: Database): Hono<AppEnv> {
  const auth = createAuth({
    db,
    secret: TEST_AUTH_SECRET,
    baseURL: TEST_API_ORIGIN,
    trustedOrigins: [TEST_CLIENT_ORIGIN],
    cookiePrefix: API_COOKIE_PREFIX,
  });
  return createApp({
    auth: createAuthGateway(auth),
    db,
    clientOrigins: [TEST_CLIENT_ORIGIN],
  });
}

/** Signs up a fresh user through the auth routes; returns the API cookie. */
export async function signUpThroughAuthRoutes(
  app: Hono<AppEnv>,
  label: string,
): Promise<{ cookie: string; email: string }> {
  const email = createUniqueTestEmail(label);
  const response = await app.request(
    `${TEST_API_ORIGIN}/api/auth/sign-up/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: TEST_CLIENT_ORIGIN,
      },
      body: JSON.stringify({
        name: "Mounted user",
        email,
        password: TEST_PASSWORD,
      }),
    },
  );
  if (response.status !== 200) {
    throw new Error(`Sign-up through auth routes failed: ${response.status}`);
  }
  return { cookie: response.headers.get("set-cookie") ?? "", email };
}
