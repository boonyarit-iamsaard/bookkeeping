import { Hono } from "hono";
import * as z from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const healthRoutes = new Hono().get("/health", (c) =>
  c.json({ status: "ok" }),
);
