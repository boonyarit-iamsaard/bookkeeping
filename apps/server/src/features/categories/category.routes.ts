import type {
  CategoryErrorField,
  CreateCategoryError,
  UpdateCategoryError,
} from "@bookkeeping/application/categories";
import {
  createCategory,
  findCategory,
  findCategoryUsage,
  initializeDefaultCategories,
  listCategories,
  updateCategory,
} from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import { CATEGORY_KINDS } from "@bookkeeping/domain/categories";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute, validator } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import type { idempotencyKeyHeaderSchema } from "../../core/http/idempotency.js";
import {
  idempotencyConflictProblem,
  idempotencyKeyMiddleware,
} from "../../core/http/idempotency.js";
import {
  describeProblem,
  describeProblemResponse,
} from "../../core/http/openapi.js";
import type {
  ProblemFieldError,
  problemDetailsSchema,
} from "../../core/http/problem-details.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "../../core/http/problem-details.js";
import {
  createInvalidCommandProblem,
  createResourceParamMiddleware,
} from "../../core/http/request-validation.js";

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

export const createCategoryRequestSchema = z
  .strictObject({
    kind: z.enum(CATEGORY_KINDS),
    name: z.string(),
    iconId: z.string(),
    parent: z.union([
      z.null(),
      z.strictObject({ existingId: z.uuid() }),
      z.strictObject({
        create: z.strictObject({ name: z.string(), iconId: z.string() }),
      }),
    ]),
  })
  .meta({ id: "CreateCategoryRequest" });

/** The presentation details an update carries; nothing else can change. */
export const updateCategoryRequestSchema = z
  .strictObject({ name: z.string(), iconId: z.string() })
  .meta({ id: "UpdateCategoryRequest" });

export const categoryUsageResponseSchema = z
  .object({ transactions: z.number().int(), children: z.number().int() })
  .meta({ id: "CategoryUsage" });

export const provisioningOutcomeResponseSchema = z
  .object({
    seededKinds: z.array(z.enum(CATEGORY_KINDS)),
  })
  .meta({ id: "ProvisioningOutcome" });

const DEFAULTS_PATH = "/categories/defaults";
const COLLECTION_PATH = "/categories";
const RESOURCE_PATH = "/categories/:categoryId";
const USAGE_PATH = "/categories/:categoryId/usage";
const LOCATION_HEADER = "Location";

const categoryParamsSchema = z.object({ categoryId: z.uuid() });
const categoryParamMiddleware =
  createResourceParamMiddleware(categoryParamsSchema);

interface CreateCategoryValidatedInput {
  in: {
    json: z.input<typeof createCategoryRequestSchema>;
    header: z.input<typeof idempotencyKeyHeaderSchema>;
  };
  out: {
    json: z.output<typeof createCategoryRequestSchema>;
    header: z.output<typeof idempotencyKeyHeaderSchema>;
  };
}

/** What the param and command validators hand a handler. */
interface CategoryCommandValidatedInput<Schema extends z.ZodType> {
  in: {
    param: z.input<typeof categoryParamsSchema>;
    json: z.input<Schema>;
  };
  out: {
    param: z.output<typeof categoryParamsSchema>;
    json: z.output<Schema>;
  };
}

const CATEGORY_ISSUE_POINTERS: Record<CategoryErrorField, string> = {
  name: "#/name",
  iconId: "#/iconId",
  parentName: "#/parent/create/name",
  parentIconId: "#/parent/create/iconId",
};

function toCategoryFieldError(
  error: Exclude<CreateCategoryError, { code: "idempotency-conflict" }>,
): ProblemFieldError {
  switch (error.code) {
    case "blank-name":
    case "name-too-long":
    case "unknown-icon":
    case "duplicate-name":
      return {
        pointer: CATEGORY_ISSUE_POINTERS[error.field],
        code: error.code,
      };
    case "parent-not-found":
    case "parent-is-child":
    case "parent-protected":
      return { pointer: "#/parent", code: error.code };
  }
}

// An update rejects on name or icon alone; Uncategorized's fixed name is a
// name problem, since choosing its current name is the correction.
function toCategoryUpdateFieldError(
  error: Exclude<UpdateCategoryError, { code: "category-not-found" }>,
): ProblemFieldError {
  switch (error.code) {
    case "blank-name":
    case "name-too-long":
    case "duplicate-name":
    case "protected":
      return { pointer: "#/name", code: error.code };
    case "unknown-icon":
      return { pointer: "#/iconId", code: error.code };
  }
}

function createCategoryCommandMiddleware(schema: z.ZodType) {
  return validator("json", schema, (result, c) => {
    if (!result.success) {
      return createProblemResponse(
        c,
        createInvalidCommandProblem(result.error),
      );
    }
  });
}

const categoryBodyMiddleware = createCategoryCommandMiddleware(
  createCategoryRequestSchema,
);

export function createCategoryRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .post(
      COLLECTION_PATH,
      describeRoute({
        operationId: "createCategory",
        summary: "Create a category",
        description:
          "Creates a parent or a child in the signed-in owner's income or " +
          "expense tree. Names are trimmed and unique within their parent " +
          "scope. The request must carry a client-generated Idempotency-Key: " +
          "repeating it with the same normalized payload replays the original " +
          "creation, while a different payload is a conflict. A rejected " +
          "request never consumes its key.",
        tags: ["Categories"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      idempotencyKeyMiddleware,
      categoryBodyMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        CreateCategoryValidatedInput,
        {
          201: typeof categoryResponseSchema;
          409: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const created = await createCategory(db, {
            ...body,
            ownerId: c.get("session").user.id,
            idempotencyKey: c.req.valid("header")["idempotency-key"],
          });
          if (!created.ok) {
            if (created.error.code === "idempotency-conflict") {
              return createProblemResponse(c, idempotencyConflictProblem);
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: [toCategoryFieldError(created.error)],
            });
          }
          const category = created.value.category;
          return c.json(category, 201, {
            [LOCATION_HEADER]: `${c.req.path}/${category.id}`,
          });
        },
        {
          201: {
            description: "The created category, or the original on a replay",
            headers: {
              [LOCATION_HEADER]: {
                description: "Where the created category can be retrieved",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": { vSchema: categoryResponseSchema },
            },
          },
          409: describeProblem(idempotencyConflictProblem),
          422: describeProblem(getProblemOptionsForStatus(422)),
        },
      ),
    )
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
              // The response schema types a mutable array; the summaries
              // themselves are already the wire shape.
              items: [...categories],
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
    .get(
      RESOURCE_PATH,
      describeRoute({
        operationId: "getCategory",
        summary: "Get a category",
        description:
          "One category the signed-in owner holds, as listed in its tree. " +
          "A category that does not exist, belongs to another owner, or has " +
          "a malformed identifier is not found alike.",
        tags: ["Categories"],
        responses: { 401: describeProblemResponse(401) },
      }),
      categoryParamMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        Input,
        { 200: typeof categoryResponseSchema; 404: typeof problemDetailsSchema }
      >(
        async (c) => {
          const category = await findCategory(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("categoryId"),
          });
          if (category === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(category, 200);
        },
        {
          200: {
            description: "The category",
            content: {
              "application/json": { vSchema: categoryResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
        },
      ),
    )
    .patch(
      RESOURCE_PATH,
      describeRoute({
        operationId: "updateCategory",
        summary: "Update a category",
        description:
          "Renames the category and/or changes its icon in one save. The " +
          "tree position and kind never change, and names stay unique " +
          "within their scope, case-insensitively. Uncategorized keeps its " +
          "name; its icon can still change, so repeating its exact current " +
          "name and icon succeeds without effect. A category that does not " +
          "exist, belongs to another owner, or has a malformed identifier " +
          "is not found alike.",
        tags: ["Categories"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      categoryParamMiddleware,
      createCategoryCommandMiddleware(updateCategoryRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        CategoryCommandValidatedInput<typeof updateCategoryRequestSchema>,
        {
          200: typeof categoryResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const updated = await updateCategory(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").categoryId,
            name: body.name,
            iconId: body.iconId,
          });
          if (!updated.ok) {
            if (updated.error.code === "category-not-found") {
              return createProblemResponse(c, getProblemOptionsForStatus(404));
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: [toCategoryUpdateFieldError(updated.error)],
            });
          }
          return c.json(updated.value, 200);
        },
        {
          200: {
            description: "The category with its updated presentation",
            content: {
              "application/json": { vSchema: categoryResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
          422: describeProblem(getProblemOptionsForStatus(422)),
        },
      ),
    )
    .get(
      USAGE_PATH,
      describeRoute({
        operationId: "getCategoryUsage",
        summary: "Get a category's usage",
        description:
          "The current income and expense transactions filed under the " +
          "category and the child categories it holds: the information " +
          "needed before removing it. Refunds follow their expense's " +
          "category and are not counted. A category that does not exist, " +
          "belongs to another owner, or has a malformed identifier is not " +
          "found alike.",
        tags: ["Categories"],
        responses: { 401: describeProblemResponse(401) },
      }),
      categoryParamMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof USAGE_PATH,
        Input,
        {
          200: typeof categoryUsageResponseSchema;
          404: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const usage = await findCategoryUsage(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("categoryId"),
          });
          if (usage === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(usage, 200);
        },
        {
          200: {
            description: "The category's transactions and children",
            content: {
              "application/json": {
                vSchema: categoryUsageResponseSchema,
              },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
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
