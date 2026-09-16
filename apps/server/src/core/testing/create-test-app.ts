import type { Hono } from "hono";
import { createApp } from "../app.js";
import type { AuthMount } from "../auth/auth.js";
import type { AppEnv } from "../http/request-context.js";

export const TEST_CLIENT_ORIGIN = "http://localhost:4000";

/** An auth mount that serves nothing and never resolves a session. */
export const anonymousAuthMount: AuthMount = {
  async handleRequest() {
    return new Response(null, { status: 404 });
  },
  async resolveSession() {
    return null;
  },
};

export function createTestApp(
  auth: AuthMount = anonymousAuthMount,
): Hono<AppEnv> {
  return createApp({ auth, clientOrigins: [TEST_CLIENT_ORIGIN] });
}
