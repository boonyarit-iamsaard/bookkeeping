import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import { CATEGORY_KINDS } from "@bookkeeping/domain/categories";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { describeProblemResponse } from "../../core/http/openapi.js";

export const provisioningOutcomeResponseSchema = z
  .object({
    seededKinds: z.array(z.enum(CATEGORY_KINDS)),
  })
  .meta({ id: "ProvisioningOutcome" });

const DEFAULTS_PATH = "/categories/defaults";

export function createCategoryRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>().post(
    DEFAULTS_PATH,
    describeRoute({
      operationId: "initializeDefaultCategories",
      summary: "Initialize default categories",
      description:
        "Creates any default category tree the signed-in owner is missing. " +
        "Sign-up provisions the set automatically; call this after sign-up " +
        "or sign-in to complete an interrupted provisioning. Idempotent: " +
        "existing trees, including customized ones, are left untouched.",
      tags: ["Categories"],
      responses: { 401: describeProblemResponse(401) },
    }),
    // The generics are explicit because the library cannot infer the
    // authenticated environment from an async handler; without them the
    // session variable types as `never`.
    describeResponse<
      AuthenticatedEnv,
      typeof DEFAULTS_PATH,
      Input,
      { 200: typeof provisioningOutcomeResponseSchema }
    >(
      async (c) => {
        const outcome = await initializeDefaultCategories(
          db,
          c.get("session").user.id,
        );
        return c.json({ seededKinds: [...outcome.seededKinds] }, 200);
      },
      {
        200: {
          description:
            "The trees this call seeded; empty when already complete",
          content: {
            "application/json": { vSchema: provisioningOutcomeResponseSchema },
          },
        },
      },
    ),
  );
}
