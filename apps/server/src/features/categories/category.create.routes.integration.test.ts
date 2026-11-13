import { categories } from "@bookkeeping/database/categories";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  CATEGORIES_URL,
  createProvisionedOwner,
  listCategories,
} from "../../testing/category-route-fixture.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  provisioningOutcomeResponseSchema,
} from "./category.routes.js";

const { withRollback } = setupTestDatabase();

const DEFAULTS_URL = `${TEST_API_ORIGIN}/v1/categories/defaults`;

function retryProvisioning(app: Hono<AppEnv>, cookie: string) {
  return app.request(DEFAULTS_URL, {
    method: "POST",
    headers: { cookie, origin: TEST_CLIENT_ORIGIN },
  });
}

interface CreateCategoryRequest {
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
  rawBody?: string;
}

const CATEGORY_REQUEST = {
  kind: "expense",
  name: "Beverages",
  iconId: "beer",
  parent: null,
};

function postCategory(
  app: Hono<AppEnv>,
  {
    cookie,
    idempotencyKey,
    body = CATEGORY_REQUEST,
    rawBody,
  }: Readonly<CreateCategoryRequest>,
) {
  return app.request(CATEGORIES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(idempotencyKey === undefined
        ? {}
        : { "idempotency-key": idempotencyKey }),
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

describe("POST /v1/categories", () => {
  test("creates a parent, returns its representation, and gives its location", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);

      const response = await postCategory(app, {
        cookie,
        idempotencyKey: "parent-create",
      });
      const category = categoryResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("location")).toBe(
        `/v1/categories/${category.id}`,
      );
      expect(category).toEqual({
        id: category.id,
        kind: "expense",
        parentId: null,
        name: "Beverages",
        iconId: "beer",
        isProtected: false,
      });

      const located = await app.request(
        `${TEST_API_ORIGIN}${response.headers.get("location")}`,
        { headers: { cookie, origin: TEST_CLIENT_ORIGIN } },
      );
      expect(located.status).toBe(200);
      expect(categoryResponseSchema.parse(await located.json())).toEqual(
        category,
      );
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      expect(collection.items).toContainEqual(category);
    });
  });

  test("replays a normalized payload and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const first = await postCategory(app, {
        cookie,
        idempotencyKey: "retry",
      });
      const original = await first.json();

      const retry = await postCategory(app, {
        cookie,
        idempotencyKey: "retry",
        body: { ...CATEGORY_REQUEST, name: "  Beverages  " },
      });
      expect(retry.status).toBe(201);
      expect(retry.headers.get("location")).toBe(first.headers.get("location"));
      expect(await retry.json()).toEqual(original);

      await expectProblem(
        await postCategory(app, {
          cookie,
          idempotencyKey: "retry",
          body: { ...CATEGORY_REQUEST, iconId: "film" },
        }),
        { status: 409, code: "idempotency-conflict" },
      );
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      expect(
        collection.items.filter((category) => category.name === "Beverages"),
      ).toHaveLength(1);
    });
  });

  test("does not consume an idempotency key when command validation rejects it", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);

      await expectProblem(
        await postCategory(app, {
          cookie,
          idempotencyKey: "correct-after-validation",
          body: { ...CATEGORY_REQUEST, name: "   " },
        }),
        { status: 422, code: "invalid-command" },
      );
      const corrected = await postCategory(app, {
        cookie,
        idempotencyKey: "correct-after-validation",
        body: { ...CATEGORY_REQUEST, name: "Coffee" },
      });
      expect(corrected.status).toBe(201);
    });
  });

  test("maps invalid, duplicate, protected, and cross-owner parents to field errors", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
      const parentResponse = await postCategory(app, {
        cookie: alice.cookie,
        idempotencyKey: "alice-parent",
      });
      const parent = categoryResponseSchema.parse(await parentResponse.json());

      const duplicate = await postCategory(app, {
        cookie: alice.cookie,
        idempotencyKey: "duplicate",
        body: { ...CATEGORY_REQUEST, name: " beverages " },
      });
      const duplicateProblem = await expectProblem(duplicate, {
        status: 422,
        code: "invalid-command",
      });
      expect(duplicateProblem.errors).toEqual([
        { pointer: "#/name", code: "duplicate-name" },
      ]);

      const protectedCategory = categoryCollectionResponseSchema
        .parse(await (await listCategories(app, alice.cookie)).json())
        .items.find(
          (category) => category.kind === "expense" && category.isProtected,
        );
      if (!protectedCategory) {
        throw new Error("Expected the protected expense category");
      }
      const protectedProblem = await expectProblem(
        await postCategory(app, {
          cookie: alice.cookie,
          idempotencyKey: "protected-parent",
          body: {
            ...CATEGORY_REQUEST,
            name: "Protected child",
            parent: { existingId: protectedCategory.id },
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(protectedProblem.errors).toEqual([
        { pointer: "#/parent", code: "parent-protected" },
      ]);

      const foreignProblem = await expectProblem(
        await postCategory(app, {
          cookie: bob.cookie,
          idempotencyKey: "foreign-parent",
          body: {
            ...CATEGORY_REQUEST,
            name: "Foreign child",
            parent: { existingId: parent.id },
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(foreignProblem.errors).toEqual([
        { pointer: "#/parent", code: "parent-not-found" },
      ]);

      const invalid = await expectProblem(
        await postCategory(app, {
          cookie: alice.cookie,
          idempotencyKey: "invalid-category",
          body: { ...CATEGORY_REQUEST, name: " ", iconId: "retired-glyph" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(invalid.errors).toEqual([
        { pointer: "#/name", code: "blank-name" },
      ]);
    });
  });

  test("requires a usable idempotency key", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);

      for (const idempotencyKey of [undefined, "   ", "x".repeat(256)]) {
        await expectProblem(
          await postCategory(app, { cookie, idempotencyKey }),
          { status: 400, code: "idempotency-key-required" },
        );
      }
    });
  });

  test("rejects malformed JSON with the standard problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);

      await expectProblem(
        await postCategory(app, {
          cookie,
          idempotencyKey: "bad-json",
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});
describe("POST /v1/categories/defaults", () => {
  test("completes a signed-in owner's default set and reports what it seeded", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createProvisionedOwner(db);
      // The fixture provisions; remove one tree to leave the owner
      // incomplete the way an interrupted hook would.
      await db
        .delete(categories)
        .where(
          and(eq(categories.userId, ownerId), eq(categories.kind, "income")),
        );

      const response = await retryProvisioning(app, cookie);
      const outcome = provisioningOutcomeResponseSchema.parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(outcome).toEqual({ seededKinds: ["income"] });
    });
  });
});
