import type { Hono } from "hono";
import { createApp } from "../core/app.js";
import type { AuthGateway } from "../core/auth/auth.js";
import type { AppEnv } from "../core/http/request-context.js";

export const TEST_CLIENT_ORIGIN = "http://localhost:4000";

/** An auth gateway that serves nothing and never resolves a session. */
export const anonymousAuthGateway: AuthGateway = {
  async handleRequest() {
    return new Response(null, { status: 404 });
  },
  async resolveSession() {
    return null;
  },
};

export function createTestApp(
  auth: AuthGateway = anonymousAuthGateway,
): Hono<AppEnv> {
  return createApp({ auth, clientOrigins: [TEST_CLIENT_ORIGIN] });
}
