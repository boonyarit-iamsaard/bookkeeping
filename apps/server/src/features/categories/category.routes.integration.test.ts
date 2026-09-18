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
