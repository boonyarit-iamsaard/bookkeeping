import type { Database } from "@bookkeeping/database/connection";
import { createDatabase } from "@bookkeeping/database/connection";
import type { Hono } from "hono";
import { createApp } from "../core/app.js";
import type { AuthGateway } from "../core/auth/gateway.js";
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

/**
 * A pool opens no connection until it is queried, so unit tests that never
 * reach a database can hold this handle; a query against it fails to connect.
 */
const unconnectedDatabase = createDatabase(
  "postgresql://unit-tests.invalid/never",
).db;

export interface UnitTestAppOptions {
  auth?: AuthGateway;
  db?: Database;
}

export function createUnitTestApp({
  auth = anonymousAuthGateway,
  db = unconnectedDatabase,
}: Readonly<UnitTestAppOptions> = {}): Hono<AppEnv> {
  return createApp({ auth, db, clientOrigins: [TEST_CLIENT_ORIGIN] });
}
