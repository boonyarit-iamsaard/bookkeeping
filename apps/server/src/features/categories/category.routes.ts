import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { CATEGORY_KINDS } from "@bookkeeping/domain/categories";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import { describeProblemResponse } from "../../core/http/openapi.js";

export const categoryResponseSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(CATEGORY_KINDS),
    parentId: z.uuid().nullable(),
    name: z.string(),
    iconId: z.string(),
    isProtected: z.boolean(),
  })
  .meta({ id: "Category" });

export const categoryCollectionResponseSchema = createCollectionResponseSchema(
  categoryResponseSchema,
).meta({ id: "CategoryCollection" });

export interface CategoryResponse extends CategorySummary {}

export function presentCategory(
  category: Readonly<CategorySummary>,
): CategoryResponse {
  return { ...category };
}

export const provisioningOutcomeResponseSchema = z
  .object({
    seededKinds: z.array(z.enum(CATEGORY_KINDS)),
  })
  .meta({ id: "ProvisioningOutcome" });

const DEFAULTS_PATH = "/categories/defaults";
const COLLECTION_PATH = "/categories";

export function createCategoryRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .get(
      COLLECTION_PATH,
      describeRoute({
        operationId: "listCategories",
        summary: "List categories",
        description:
          "Returns the signed-in owner's income and expense category trees " +
          "in picker order. Parents precede their children, protected " +
          "Uncategorized entries are included, and reads never initialize " +
          "or modify a missing tree. The collection is unpaginated; " +
          "`nextCursor` is always null.",
        tags: ["Categories"],
        responses: { 401: describeProblemResponse(401) },
      }),
      // The generics are explicit because the library cannot infer the
      // authenticated environment from an async handler; without them the
      // session variable types as `never`.
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        Input,
        { 200: typeof categoryCollectionResponseSchema }
      >(
        async (c) => {
          const categories = await listCategories(db, c.get("session").user.id);
          return c.json(
            {
              items: categories.map(presentCategory),
              page: { nextCursor: null },
            },
            200,
          );
        },
        {
          200: {
            description: "The owner's income and expense category trees",
            content: {
              "application/json": {
                vSchema: categoryCollectionResponseSchema,
              },
            },
          },
        },
      ),
    )
    .post(
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
              "application/json": {
                vSchema: provisioningOutcomeResponseSchema,
              },
            },
          },
        },
      ),
    );
}
