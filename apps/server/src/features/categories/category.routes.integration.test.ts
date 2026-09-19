import { createCategoryForTest } from "@bookkeeping/application/testing/category-fixture";
import {
  insertCategorizedTransaction,
  insertLinkedRefund,
} from "@bookkeeping/application/testing/transaction-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { databaseError } from "@bookkeeping/database/errors";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
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
import { expectProblem } from "../../testing/expect-problem.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  categoryUsageResponseSchema,
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

interface ListedCategoryRequest {
  name: string;
  cookie: string;
}

/** The owner's category of that name, as the collection lists it. */
async function findListedCategory(
  app: Readonly<Hono<AppEnv>>,
  { name, cookie }: Readonly<ListedCategoryRequest>,
) {
  const collection = categoryCollectionResponseSchema.parse(
    await (await listCategories(app, cookie)).json(),
  );
  const category = collection.items.find((item) => item.name === name);
  if (!category) {
    throw new Error(`Expected the ${name} category`);
  }
  return category;
}

interface GetCategoryRequest {
  categoryId: string;
  cookie?: string;
}

function getCategory(
  app: Readonly<Hono<AppEnv>>,
  { categoryId, cookie }: Readonly<GetCategoryRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}`, {
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

const UPDATE_REQUEST = { name: "Beverages", iconId: "wine" };

interface UpdateCategoryRequest {
  categoryId: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

function patchCategory(
  app: Hono<AppEnv>,
  {
    categoryId,
    cookie,
    body = UPDATE_REQUEST,
    rawBody,
  }: Readonly<UpdateCategoryRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

interface GetCategoryUsageRequest {
  categoryId: string;
  cookie?: string;
}

function getCategoryUsage(
  app: Readonly<Hono<AppEnv>>,
  { categoryId, cookie }: Readonly<GetCategoryUsageRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}/usage`, {
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
  });
}

interface DeleteCategoryRequest {
  categoryId: string;
  cookie?: string;
}

function deleteCategory(
  app: Readonly<Hono<AppEnv>>,
  { categoryId, cookie }: Readonly<DeleteCategoryRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}`, {
    method: "DELETE",
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
  });
}

/** Where one committed transaction is currently filed. */
async function filedCategory(db: Database, transactionId: string) {
  const [row] = await db
    .select({ categoryId: transactions.categoryId })
    .from(transactions)
    .where(eq(transactions.id, transactionId));
  return row?.categoryId ?? null;
}

/** Asserts a route answers the same 404 for unknown, foreign, and malformed ids. */
async function expectNotFoundAlike(
  attempt: (id: string) => Response | Promise<Response>,
  foreignId: string,
) {
  for (const id of [
    "00000000-0000-0000-0000-000000000000",
    foreignId,
    "not-a-uuid",
  ]) {
    await expectProblem(await attempt(id), { status: 404, code: "not-found" });
  }
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

describe("GET /v1/categories/{categoryId}", () => {
  test("returns one owned category as its tree lists it", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const uncategorized = collection.items.find(
        (category) => category.kind === "income" && category.isProtected,
      );
      if (!uncategorized) {
        throw new Error("Expected a protected income category");
      }

      const response = await getCategory(app, {
        categoryId: uncategorized.id,
        cookie,
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(categoryResponseSchema.parse(await response.json())).toEqual(
        uncategorized,
      );
    });
  });

  test("treats unknown, cross-owner, and malformed ids as not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      const bobsTree = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, bob.cookie)).json(),
      );
      const bobsCategory = bobsTree.items[0];
      if (!bobsCategory) {
        throw new Error("Expected Bob to have categories");
      }

      await expectNotFoundAlike(
        (id) => getCategory(app, { categoryId: id, cookie: alice.cookie }),
        bobsCategory.id,
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await getCategory(createIntegrationTestApp(db), {
        categoryId: "00000000-0000-0000-0000-000000000000",
      });

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

describe("PATCH /v1/categories/{categoryId}", () => {
  test("renames and re-icons in one save, leaving the tree position alone", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const response = await patchCategory(app, {
        categoryId: groceries.id,
        cookie,
        body: { name: "  Supermarket  ", iconId: "store" },
      });
      const updated = categoryResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(updated).toEqual({
        id: groceries.id,
        kind: "expense",
        parentId: groceries.parentId,
        name: "Supermarket",
        iconId: "store",
        isProtected: false,
      });
      const after = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      expect(
        after.items.find((category) => category.id === groceries.id),
      ).toEqual(updated);
      const located = await getCategory(app, {
        categoryId: groceries.id,
        cookie,
      });
      expect(categoryResponseSchema.parse(await located.json())).toEqual(
        updated,
      );
    });
  });

  test("lets Uncategorized change its icon but never its name", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const uncategorized = collection.items.find(
        (category) => category.kind === "expense" && category.isProtected,
      );
      if (!uncategorized) {
        throw new Error("Expected the protected expense category");
      }

      const reiconed = await patchCategory(app, {
        categoryId: uncategorized.id,
        cookie,
        body: { name: "Uncategorized", iconId: "sparkles" },
      });
      expect(reiconed.status).toBe(200);
      expect(categoryResponseSchema.parse(await reiconed.json())).toEqual(
        expect.objectContaining({ iconId: "sparkles", isProtected: true }),
      );

      const renamed = await patchCategory(app, {
        categoryId: uncategorized.id,
        cookie,
        body: { name: "Misc", iconId: "sparkles" },
      });
      const problem = await expectProblem(renamed, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/name", code: "protected" },
      ]);
    });
  });

  test("maps duplicate, invalid, and unknown-field commands to field errors", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const duplicate = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: " restaurants ", iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(duplicate.errors).toEqual([
        { pointer: "#/name", code: "duplicate-name" },
      ]);

      const blank = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "   ", iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(blank.errors).toEqual([{ pointer: "#/name", code: "blank-name" }]);

      const unknownIcon = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "Groceries", iconId: "retired-glyph" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(unknownIcon.errors).toEqual([
        { pointer: "#/iconId", code: "unknown-icon" },
      ]);

      const tooLong = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "x".repeat(61), iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(tooLong.errors).toEqual([
        { pointer: "#/name", code: "name-too-long" },
      ]);

      await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { ...UPDATE_REQUEST, parentId: groceries.parentId },
        }),
        { status: 422, code: "invalid-command" },
      );

      const unchanged = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      expect(unchanged.items.find((c) => c.id === groceries.id)).toEqual(
        groceries,
      );
    });
  });

  test("treats unknown, cross-owner, and malformed ids as not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      const bobsTree = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, bob.cookie)).json(),
      );
      const bobsCategory = bobsTree.items[0];
      if (!bobsCategory) {
        throw new Error("Expected Bob to have categories");
      }

      await expectNotFoundAlike(
        (id) =>
          patchCategory(app, {
            categoryId: id,
            cookie: alice.cookie,
            body: { name: "Mine", iconId: "bus" },
          }),
        bobsCategory.id,
      );
      const bobsAfter = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, bob.cookie)).json(),
      );
      expect(bobsAfter.items.find((c) => c.id === bobsCategory.id)).toEqual(
        bobsCategory,
      );
    });
  });

  test("rejects malformed JSON and anonymous requests with standard problems", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const anyCategory = collection.items[0];
      if (!anyCategory) {
        throw new Error("Expected the default categories");
      }

      await expectProblem(
        await patchCategory(app, {
          categoryId: anyCategory.id,
          cookie,
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(
        await patchCategory(createIntegrationTestApp(db), {
          categoryId: anyCategory.id,
        }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

describe("GET /v1/categories/{categoryId}/usage", () => {
  test("reports the transactions a category holds and the children under a parent", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      const wallet = await createWalletForTest(db, { ownerId });
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });
      const restaurants = await findListedCategory(app, {
        name: "Restaurants",
        cookie,
      });
      const foodAndDrink = await findListedCategory(app, {
        name: "Food & Drink",
        cookie,
      });
      const expense = await insertCategorizedTransaction(db, {
        ownerId,
        walletId: wallet.id,
        categoryId: groceries.id,
      });
      await insertCategorizedTransaction(db, {
        ownerId,
        walletId: wallet.id,
        categoryId: groceries.id,
        amount: 12_500n,
      });
      // Refunds follow their expense's category and are not counted.
      await insertLinkedRefund(db, {
        ownerId,
        walletId: wallet.id,
        refundOfTransactionId: expense,
      });
      const gone = await insertCategorizedTransaction(db, {
        ownerId,
        walletId: wallet.id,
        categoryId: restaurants.id,
      });
      await db
        .update(transactions)
        .set({ deletedAt: new Date() })
        .where(
          and(eq(transactions.id, gone), eq(transactions.userId, ownerId)),
        );

      const groceriesResponse = await getCategoryUsage(app, {
        categoryId: groceries.id,
        cookie,
      });
      expect(groceriesResponse.status).toBe(200);
      expect(groceriesResponse.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(
        categoryUsageResponseSchema.parse(await groceriesResponse.json()),
      ).toEqual({ transactions: 2, children: 0 });
      expect(
        categoryUsageResponseSchema.parse(
          await (
            await getCategoryUsage(app, { categoryId: foodAndDrink.id, cookie })
          ).json(),
        ),
      ).toEqual({ transactions: 0, children: 4 });
      expect(
        categoryUsageResponseSchema.parse(
          await (
            await getCategoryUsage(app, {
              categoryId: restaurants.id,
              cookie,
            })
          ).json(),
        ),
      ).toEqual({ transactions: 0, children: 0 });
    });
  });

  test("treats unknown, cross-owner, and malformed ids as not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      const bobsTree = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, bob.cookie)).json(),
      );
      const bobsCategory = bobsTree.items[0];
      if (!bobsCategory) {
        throw new Error("Expected Bob to have categories");
      }

      await expectNotFoundAlike(
        (id) => getCategoryUsage(app, { categoryId: id, cookie: alice.cookie }),
        bobsCategory.id,
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await getCategoryUsage(createIntegrationTestApp(db), {
        categoryId: "00000000-0000-0000-0000-000000000000",
      });

      await expectProblem(response, { status: 401, code: "unauthenticated" });
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

describe("DELETE /v1/categories/{categoryId}", () => {
  test("removes an unused child with no response body and makes a repeat not found", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const response = await deleteCategory(app, {
        categoryId: groceries.id,
        cookie,
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");
      await expectProblem(
        await deleteCategory(app, { categoryId: groceries.id, cookie }),
        { status: 404, code: "not-found" },
      );
    });
  });

  test("reassigns a removed child's transactions to its parent", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      const wallet = await createWalletForTest(db, { ownerId });
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });
      const foodAndDrink = await findListedCategory(app, {
        name: "Food & Drink",
        cookie,
      });
      await insertCategorizedTransaction(db, {
        ownerId,
        walletId: wallet.id,
        categoryId: groceries.id,
      });
      const usageBefore = categoryUsageResponseSchema.parse(
        await (
          await getCategoryUsage(app, { categoryId: foodAndDrink.id, cookie })
        ).json(),
      );

      const response = await deleteCategory(app, {
        categoryId: groceries.id,
        cookie,
      });

      expect(response.status).toBe(204);
      await expectProblem(
        await getCategory(app, { categoryId: groceries.id, cookie }),
        { status: 404, code: "not-found" },
      );
      const usageAfter = categoryUsageResponseSchema.parse(
        await (
          await getCategoryUsage(app, { categoryId: foodAndDrink.id, cookie })
        ).json(),
      );
      expect(usageAfter.children).toBe(usageBefore.children - 1);
      expect(usageAfter.transactions).toBe(usageBefore.transactions + 1);
    });
  });

  test("returns one stable conflict problem for protected and for a parent with children", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const uncategorized = await findListedCategory(app, {
        name: "Uncategorized",
        cookie,
      });
      const foodAndDrink = await findListedCategory(app, {
        name: "Food & Drink",
        cookie,
      });

      for (const categoryId of [uncategorized.id, foodAndDrink.id]) {
        await expectProblem(await deleteCategory(app, { categoryId, cookie }), {
          status: 409,
          code: "conflict",
        });
        // Every blocker is definitive: the category is still listed.
        expect((await getCategory(app, { categoryId, cookie })).status).toBe(
          200,
        );
      }
    });
  });

  test("a transaction landing during the removal makes it a conflict or moves up, never orphaned", async () => {
    // The race needs separate transactions, so this test commits; the owner
    // is fresh, so nothing else observes the rows.
    const db = committed();
    const app = createIntegrationTestApp(db);
    const { cookie, ownerId } = await signUp(app);
    const wallet = await createWalletForTest(db, { ownerId });
    const foodAndDrink = await findListedCategory(app, {
      name: "Food & Drink",
      cookie,
    });
    const created = await createCategoryForTest(db, {
      ownerId,
      kind: "expense",
      name: "Takeaway",
      iconId: "generic",
      parent: { existingId: foodAndDrink.id },
    });
    if (!created.ok) {
      throw new Error(created.error.code);
    }
    const takeaway = created.value.category;

    const [removed, inserted] = await Promise.all([
      deleteCategory(app, { categoryId: takeaway.id, cookie }),
      insertCategorizedTransaction(db, {
        ownerId,
        walletId: wallet.id,
        categoryId: takeaway.id,
      }).then(
        (filed) => ({ filed }),
        (error: unknown) => ({ rejected: error }),
      ),
    ]);
    if ("filed" in inserted) {
      const filed = await filedCategory(db, inserted.filed);
      if (removed.status === 204) {
        // The removal's reassignment claimed the entry as it moved up.
        expect(filed).toBe(foodAndDrink.id);
      } else {
        await expectProblem(removed, { status: 409, code: "conflict" });
        expect(filed).toBe(takeaway.id);
      }
    } else {
      // The category vanished under the insert; its restrict FK refused it.
      expect(removed.status).toBe(204);
      expect(databaseError(inserted.rejected)?.code).toBe("23503");
    }
  });

  test("does not disclose missing or another owner's categories", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie: alice.cookie,
      });

      await expectNotFoundAlike(
        (categoryId) => deleteCategory(app, { categoryId, cookie: bob.cookie }),
        groceries.id,
      );
      expect(
        (
          await getCategory(app, {
            categoryId: groceries.id,
            cookie: alice.cookie,
          })
        ).status,
      ).toBe(200);
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await deleteCategory(createIntegrationTestApp(db), {
        categoryId: "00000000-0000-0000-0000-000000000000",
      });

      await expectProblem(response, {
        status: 401,
        code: "unauthenticated",
      });
    });
  });
});
