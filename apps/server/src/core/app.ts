import { Hono } from "hono";
import { healthRoutes } from "../features/health/health.routes.js";

export function createApp(): Hono {
  const app = new Hono();

  app.route("/", healthRoutes);

  return app;
}
