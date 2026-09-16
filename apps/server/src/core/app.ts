import type { Database } from "@bookkeeping/database/connection";
import { Hono } from "hono";
import { createCategoryRoutes } from "../features/categories/category.routes.js";
import { healthRoutes } from "../features/health/health.routes.js";
import type { AuthGateway } from "./auth/gateway.js";
import { registerAuthRoutes } from "./auth/gateway.js";
import { requireSession } from "./auth/session.js";
import { createCorsMiddleware } from "./http/cors.js";
import {
  errorBoundaryMiddleware,
  handleRequestError,
} from "./http/error-handler.js";
import { registerOpenApiDocument } from "./http/openapi.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "./http/problem-details.js";
import type { AppEnv } from "./http/request-context.js";
import { requestContextMiddleware } from "./http/request-context.js";

/** Application resources live below this namespace and require a session. */
export const APPLICATION_ROUTE_PATTERN = "/v1/*";

export interface AppOptions {
  auth: AuthGateway;
  db: Database;
  clientOrigins: readonly string[];
}

export function createApp({
  auth,
  db,
  clientOrigins,
}: AppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestContextMiddleware);
  app.use("*", errorBoundaryMiddleware);
  app.use("*", createCorsMiddleware(clientOrigins));
  app.notFound((c) =>
    createProblemResponse(c, getProblemOptionsForStatus(404)),
  );
  app.onError(handleRequestError);

  app.route("/", healthRoutes);
  registerAuthRoutes(app, auth);
  app.use(APPLICATION_ROUTE_PATTERN, requireSession(auth));
  app.route("/v1", createCategoryRoutes(db));
  registerOpenApiDocument(app);

  return app;
}
