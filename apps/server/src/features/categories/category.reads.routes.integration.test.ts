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
import type { AppEnv } from "../../core/http/request-context.js";
import {
  CATEGORIES_URL,
  createProvisionedOwner,
  findListedCategory,
  listCategories,
} from "../../testing/category-route-fixture.js";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  categoryUsageCollectionResponseSchema,
  categoryUsageResponseSchema,
} from "./category.routes.js";

const { withRollback } = setupTestDatabase();

const USAGE_URL = `${CATEGORIES_URL}/usage`;

async function countCategories(db: Database, ownerId: string) {
  return (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, ownerId))
  ).length;
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
});
