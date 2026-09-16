import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
  })
  .meta({ id: "HealthResponse" });

export const healthRoutes = new Hono().get(
  "/health",
  describeRoute({
    operationId: "getHealth",
    summary: "Check server health",
    tags: ["Operations"],
  }),
  describeResponse((c) => c.json({ status: "ok" as const }), {
    200: {
      description: "Server is healthy",
      content: { "application/json": { vSchema: healthResponseSchema } },
    },
  }),
);
