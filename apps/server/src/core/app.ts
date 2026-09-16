import { Hono } from "hono";
import { healthRoutes } from "../features/health/health.routes.js";
import type { AuthMount } from "./auth/auth.js";
import { mountAuthRoutes } from "./auth/auth.js";
import { requireSession } from "./auth/session.js";
import { corsMiddleware } from "./http/cors.js";
import {
  errorBoundaryMiddleware,
  handleRequestError,
} from "./http/error-handler.js";
import { mountOpenApiDocument } from "./http/openapi.js";
import { problemForStatus, problemResponse } from "./http/problem-details.js";
import type { AppEnv } from "./http/request-context.js";
import { requestContextMiddleware } from "./http/request-context.js";

/** Application resources live below this namespace and require a session. */
export const APPLICATION_ROUTE_PATTERN = "/v1/*";

export interface AppOptions {
  auth: AuthMount;
  clientOrigins: readonly string[];
}

export function createApp({ auth, clientOrigins }: AppOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", requestContextMiddleware);
  app.use("*", errorBoundaryMiddleware);
  app.use("*", corsMiddleware(clientOrigins));
  app.notFound((c) => problemResponse(c, problemForStatus(404)));
  app.onError(handleRequestError);

  app.route("/", healthRoutes);
  mountAuthRoutes(app, auth);
  app.use(APPLICATION_ROUTE_PATTERN, requireSession(auth));
  mountOpenApiDocument(app);

  return app;
}
