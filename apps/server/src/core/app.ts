import { Hono } from "hono";
import { healthRoutes } from "../features/health/health.routes.js";
import {
  errorBoundaryMiddleware,
  handleRequestError,
} from "./http/error-handler.js";
import { mountOpenApiDocument } from "./http/openapi.js";
import { problemForStatus, problemResponse } from "./http/problem-details.js";
import type { ServerAppEnv } from "./http/request-context.js";
import { requestContextMiddleware } from "./http/request-context.js";

export function createApp(): Hono<ServerAppEnv> {
  const app = new Hono<ServerAppEnv>();

  app.use("*", requestContextMiddleware);
  app.use("*", errorBoundaryMiddleware);
  app.notFound((c) => problemResponse(c, problemForStatus(404)));
  app.onError(handleRequestError);

  app.route("/", healthRoutes);
  mountOpenApiDocument(app);

  return app;
}
