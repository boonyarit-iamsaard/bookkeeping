import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import * as z from "zod";
import { problemDetailsSchema } from "../../core/http/problem-details.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  signUpThroughAuthRoutes,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  provisioningOutcomeResponseSchema,
} from "./category.routes.js";

const { withRollback, committed } = setupTestDatabase();

const DEFAULTS_URL = `${TEST_API_ORIGIN}/v1/categories/defaults`;
const CATEGORIES_URL = `${TEST_API_ORIGIN}/v1/categories`;

const sessionResponseSchema = z.object({ user: z.object({ id: z.string() }) });

/** Signs up through the auth routes and returns the cookie plus the owner's id. */
async function signUp(app: Hono<AppEnv>) {
  const { cookie } = await signUpThroughAuthRoutes(app, "defaults");
  const session = await app.request(`${TEST_API_ORIGIN}/api/auth/get-session`, {
    headers: { cookie, origin: TEST_CLIENT_ORIGIN },
  });
  const { user } = sessionResponseSchema.parse(await session.json());
  return { cookie, ownerId: user.id };
}

async function countCategories(db: Database, ownerId: string) {
  return (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, ownerId))
  ).length;
}

function retryProvisioning(app: Hono<AppEnv>, cookie: string) {
  return app.request(DEFAULTS_URL, {
    method: "POST",
    headers: { cookie, origin: TEST_CLIENT_ORIGIN },
  });
}

function listCategories(app: Readonly<Hono<AppEnv>>, cookie?: string) {
  return app.request(CATEGORIES_URL, {
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
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

interface ExpectedProblem {
  status: number;
  code: string;
}

async function expectProblem(
  response: Response,
  expected: Readonly<ExpectedProblem>,
) {
  expect(response.status).toBe(expected.status);
  expect(response.headers.get("content-type")).toContain(
    "application/problem+json",
  );
  const problem = problemDetailsSchema.parse(await response.json());
  expect(problem.code).toBe(expected.code);
  expect(problem.type).toBe(`urn:bookkeeping:problem:${expected.code}`);
  expect(problem.status).toBe(expected.status);
  return problem;
}

describe("POST /v1/categories", () => {
  test("creates a parent, returns its representation, and gives its location", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

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

      const located = await listCategories(app, cookie);
      const collection = categoryCollectionResponseSchema.parse(
        await located.json(),
      );
      expect(collection.items).toContainEqual(category);
    });
  });

  test("creates a child together with a new parent in one request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      const response = await postCategory(app, {
        cookie,
        idempotencyKey: "child-with-parent",
        body: {
          kind: "expense",
          name: "Bubble tea",
          iconId: "coffee",
          parent: { create: { name: "Drinks", iconId: "beer" } },
        },
      });
      const child = categoryResponseSchema.parse(await response.json());
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const parent = collection.items.find(
        (category) => category.name === "Drinks",
      );

      expect(response.status).toBe(201);
      expect(parent).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: null,
          name: "Drinks",
          iconId: "beer",
          isProtected: false,
        }),
      );
      expect(child).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: parent?.id,
          name: "Bubble tea",
          iconId: "coffee",
          isProtected: false,
        }),
      );
    });
  });

  test("replays a normalized payload and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
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
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

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
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
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
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      for (const idempotencyKey of [undefined, "   ", "x".repeat(256)]) {
        await expectProblem(
          await postCategory(app, { cookie, idempotencyKey }),
          { status: 400, code: "idempotency-key-required" },
        );
      }
    });
  });

  test("concurrent requests with one key create one category and replay it", async () => {
    const db = committed();
    const app = createIntegrationTestApp(db);
    const { cookie } = await signUp(app);
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        postCategory(app, { cookie, idempotencyKey: "concurrent" }),
      ),
    );
    const bodies = await Promise.all(
      responses.map(async (response) =>
        categoryResponseSchema.parse(await response.json()),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    const collection = categoryCollectionResponseSchema.parse(
      await (await listCategories(app, cookie)).json(),
    );
    expect(
      collection.items.filter((category) => category.name === "Beverages"),
    ).toHaveLength(1);
  });

  test("rejects malformed JSON and anonymous requests with standard problems", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      await expectProblem(
        await postCategory(app, {
          cookie,
          idempotencyKey: "bad-json",
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(
        await postCategory(createIntegrationTestApp(db), {
          idempotencyKey: "anonymous",
        }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

describe("GET /v1/categories", () => {
  test("lists the signed-in owner's ordered trees with protected metadata", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await signUp(app);
      const stranger = await signUp(app);

      const response = await listCategories(app, owner.cookie);
      const collection = categoryCollectionResponseSchema.parse(
        await response.json(),
      );
      const foodAndDrink = collection.items.find(
        (category) => category.name === "Food & Drink",
      );
      const groceries = collection.items.find(
        (category) => category.name === "Groceries",
      );
      const strangerResponse = await listCategories(app, stranger.cookie);
      const strangerCollection = categoryCollectionResponseSchema.parse(
        await strangerResponse.json(),
      );
      if (!foodAndDrink || !groceries) {
        throw new Error("Expected the default expense categories");
      }

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(collection.page).toEqual({ nextCursor: null });
      expect(
        collection.items.filter((category) => category.isProtected),
      ).toEqual([
        expect.objectContaining({
          kind: "income",
          name: "Uncategorized",
          parentId: null,
        }),
        expect.objectContaining({
          kind: "expense",
          name: "Uncategorized",
          parentId: null,
        }),
      ]);
      expect(foodAndDrink).toEqual(
        expect.objectContaining({
          kind: "expense",
          parentId: null,
          isProtected: false,
        }),
      );
      expect(groceries).toEqual(
        expect.objectContaining({
          parentId: foodAndDrink.id,
          isProtected: false,
        }),
      );
      expect(collection.items.indexOf(foodAndDrink)).toBeLessThan(
        collection.items.indexOf(groceries),
      );
      expect(collection.items).toHaveLength(
        await countCategories(db, owner.ownerId),
      );
      expect(
        collection.items.some((category) =>
          strangerCollection.items.some(
            (strangerCategory) => strangerCategory.id === category.id,
          ),
        ),
      ).toBe(false);
    });
  });

  test("does not provision an incomplete owner while reading", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      await db.delete(categories).where(eq(categories.userId, ownerId));

      const before = await countCategories(db, ownerId);
      const response = await listCategories(app, cookie);
      const collection = categoryCollectionResponseSchema.parse(
        await response.json(),
      );

      expect(collection.items).toEqual([]);
      expect(await countCategories(db, ownerId)).toBe(before);
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await listCategories(createIntegrationTestApp(db));

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });
});

describe("POST /v1/categories/defaults", () => {
  test("completes a signed-in owner's default set and reports what it seeded", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      // Sign-up already provisioned; remove one tree to leave the owner
      // incomplete the way an interrupted hook would.
      await db
        .delete(categories)
        .where(
          and(eq(categories.userId, ownerId), eq(categories.kind, "income")),
        );
      const before = await countCategories(db, ownerId);

      const response = await retryProvisioning(app, cookie);
      const outcome = provisioningOutcomeResponseSchema.parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(outcome).toEqual({ seededKinds: ["income"] });
      expect(await countCategories(db, ownerId)).toBeGreaterThan(before);

      const again = await retryProvisioning(app, cookie);
      expect(await again.json()).toEqual({ seededKinds: [] });
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await createIntegrationTestApp(db).request(
        DEFAULTS_URL,
        {
          method: "POST",
          headers: { origin: TEST_CLIENT_ORIGIN },
        },
      );

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });

  test("concurrent retries by one owner seed each missing tree exactly once", async () => {
    // Concurrency needs separate transactions, so this test commits; each
    // owner is fresh, so nothing else observes the rows.
    const db = committed();
    const app = createIntegrationTestApp(db);
    const { cookie, ownerId } = await signUp(app);
    await db.delete(categories).where(eq(categories.userId, ownerId));

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => retryProvisioning(app, cookie)),
    );
    const outcomes = await Promise.all(
      responses.map(async (response) =>
        provisioningOutcomeResponseSchema.parse(await response.json()),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    expect(outcomes.flatMap((outcome) => outcome.seededKinds).sort()).toEqual([
      "expense",
      "income",
    ]);
    const protectedRows = await db
      .select({ kind: categories.kind })
      .from(categories)
      .where(
        and(eq(categories.userId, ownerId), eq(categories.isProtected, true)),
      );
    expect(protectedRows.map((row) => row.kind).sort()).toEqual([
      "expense",
      "income",
    ]);
  });

  test("one owner's retry never touches another owner's categories", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      await db.delete(categories).where(eq(categories.userId, bob.ownerId));
      const aliceBefore = await countCategories(db, alice.ownerId);

      const aliceRetry = await retryProvisioning(app, alice.cookie);

      expect(await aliceRetry.json()).toEqual({ seededKinds: [] });
      expect(await countCategories(db, bob.ownerId)).toBe(0);

      const bobRetry = await retryProvisioning(app, bob.cookie);

      expect(await bobRetry.json()).toEqual({
        seededKinds: ["income", "expense"],
      });
      expect(await countCategories(db, alice.ownerId)).toBe(aliceBefore);
      expect(await countCategories(db, bob.ownerId)).toBe(aliceBefore);
    });
  });
});
