import type { Auth } from "@bookkeeping/auth/config";
import type { Session } from "@bookkeeping/auth/session";
import { resolveSession } from "@bookkeeping/auth/session";
import type { Hono } from "hono";
import type { AppEnv } from "../http/request-context.js";

/** Better Auth's managed routes live here, outside the `/v1` namespace. */
export const AUTH_ROUTE_PATTERN = "/api/auth/*";

/**
 * The API issues `bookkeeping-api.session_token`, distinct from the Next.js
 * mount's `better-auth.session_token`, so the two mounts keep separate
 * cookies even on one local hostname.
 */
export const API_COOKIE_PREFIX = "bookkeeping-api";

/**
 * What the HTTP layer needs from authentication: serve the managed routes and
 * resolve a request's session. Tests substitute this contract; the entrypoint
 * adapts the shared Better Auth instance.
 */
export interface AuthMount {
  handleRequest(request: Request): Promise<Response>;
  resolveSession(headers: Headers): Promise<Session | null>;
}

export function createAuthMount(auth: Auth): AuthMount {
  return {
    handleRequest(request) {
      return auth.handler(request);
    },
    resolveSession(headers) {
      return resolveSession(auth, headers);
    },
  };
}

export function mountAuthRoutes(app: Hono<AppEnv>, auth: AuthMount): void {
  // Better Auth owns the methods and OpenAPI description of its routes, so
  // they are registered as one catch-all rather than documented operations.
  app.all(AUTH_ROUTE_PATTERN, (c) => auth.handleRequest(c.req.raw));
}
