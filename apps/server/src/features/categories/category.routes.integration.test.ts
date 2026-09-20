import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import {
  insertCategorizedTransaction,
  insertLinkedRefund,
} from "@bookkeeping/application/testing/transaction-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { problemDetailsSchema } from "../../core/http/problem-details.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  categoryUsageCollectionResponseSchema,
  categoryUsageResponseSchema,
  provisioningOutcomeResponseSchema,
} from "./category.routes.js";

const { withRollback } = setupTestDatabase();

const DEFAULTS_URL = `${TEST_API_ORIGIN}/v1/categories/defaults`;
const CATEGORIES_URL = `${TEST_API_ORIGIN}/v1/categories`;
const USAGE_URL = `${CATEGORIES_URL}/usage`;

/**
 * A fresh owner with the complete default category trees, the way sign-up's
 * provisioning hook leaves one.
 */
async function createProvisionedOwner(db: Database): Promise<{
  cookie: string;
  ownerId: string;
}> {
  const { cookie, ownerId } = await createOwnerSession(db);
  await initializeDefaultCategories(db, ownerId);
  return { cookie, ownerId };
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

  test("rejects malformed JSON and anonymous requests with standard problems", async () => {
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
      await expectProblem(
        await postCategory(
          createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
          {
            idempotencyKey: "anonymous",
          },
        ),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

describe("GET /v1/categories", () => {
  test("lists the signed-in owner's ordered trees with protected metadata", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const owner = await createProvisionedOwner(db);
      const stranger = await createProvisionedOwner(db);

      const response = await listCategories(app, owner.cookie);
      const collection = categoryCollectionResponseSchema.parse(
        await response.json(),
      );
      const strangerResponse = await listCategories(app, stranger.cookie);
      const strangerCollection = categoryCollectionResponseSchema.parse(
        await strangerResponse.json(),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(collection.page).toEqual({ nextCursor: null });
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

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await listCategories(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
      );

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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
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
      const response = await getCategory(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          categoryId: "00000000-0000-0000-0000-000000000000",
        },
      );

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

describe("PATCH /v1/categories/{categoryId}", () => {
  test("renames and re-icons in one save, leaving the tree position alone", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
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
    });
  });

  test("lets Uncategorized change its icon but never its name", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const uncategorized = collection.items.find(
        (category) => category.kind === "expense" && category.isProtected,
      );
      if (!uncategorized) {
        throw new Error("Expected the protected expense category");
      }

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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
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
    });
  });

  test("treats unknown, cross-owner, and malformed ids as not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
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
        await patchCategory(
          createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
          {
            categoryId: anyCategory.id,
          },
        ),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

describe("GET /v1/categories/{categoryId}/usage", () => {
  test("reports the transactions a category holds and the children under a parent", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createProvisionedOwner(db);
      const wallet = await createWalletForTest(db, { ownerId });
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });
      const restaurants = await findListedCategory(app, {
        name: "Restaurants",
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
    });
  });

  test("treats unknown, cross-owner, and malformed ids as not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
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
      const response = await getCategoryUsage(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          categoryId: "00000000-0000-0000-0000-000000000000",
        },
      );

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

describe("GET /v1/categories/usage", () => {
  function listUsage(app: Readonly<Hono<AppEnv>>, cookie?: string) {
    return app.request(USAGE_URL, {
      headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
    });
  }

  test("counts each category's current transactions in one read", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createProvisionedOwner(db);
      const wallet = await createWalletForTest(db, { ownerId });
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });
      const restaurants = await findListedCategory(app, {
        name: "Restaurants",
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
      // Refunds follow their expense's category and never count.
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

      const response = await listUsage(app, cookie);
      const body = categoryUsageCollectionResponseSchema.parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      // A category with no current transactions is absent, not zero.
      expect(body).toEqual({
        items: [{ categoryId: groceries.id, transactions: 2 }],
        page: { nextCursor: null },
      });
    });
  });

  test("never counts another owner's transactions", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
      const wallet = await createWalletForTest(db, { ownerId: alice.ownerId });
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie: alice.cookie,
      });
      await insertCategorizedTransaction(db, {
        ownerId: alice.ownerId,
        walletId: wallet.id,
        categoryId: groceries.id,
      });

      const body = categoryUsageCollectionResponseSchema.parse(
        await (await listUsage(app, bob.cookie)).json(),
      );

      expect(body).toEqual({ items: [], page: { nextCursor: null } });
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      await expectProblem(
        await listUsage(
          createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        ),
        {
          status: 401,
          code: "unauthenticated",
        },
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

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      }).request(DEFAULTS_URL, {
        method: "POST",
        headers: { origin: TEST_CLIENT_ORIGIN },
      });

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });
});

describe("DELETE /v1/categories/{categoryId}", () => {
  test("removes an unused child with no response body and makes a repeat not found", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
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

  test("names the blocker for protected and for a parent with children", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const uncategorized = await findListedCategory(app, {
        name: "Uncategorized",
        cookie,
      });
      const foodAndDrink = await findListedCategory(app, {
        name: "Food & Drink",
        cookie,
      });

      await expectProblem(
        await deleteCategory(app, { categoryId: uncategorized.id, cookie }),
        { status: 409, code: "protected" },
      );
      await expectProblem(
        await deleteCategory(app, { categoryId: foodAndDrink.id, cookie }),
        { status: 409, code: "has-children" },
      );
    });
  });

  test("does not disclose missing or another owner's categories", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createProvisionedOwner(db);
      const bob = await createProvisionedOwner(db);
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
      const response = await deleteCategory(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          categoryId: "00000000-0000-0000-0000-000000000000",
        },
      );

      await expectProblem(response, {
        status: 401,
        code: "unauthenticated",
      });
    });
  });
});
