import {
  initializeDefaultCategories,
  listCategories,
} from "@bookkeeping/application/categories";
import { createTagForTest } from "@bookkeeping/application/testing/tag-fixture";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { softDelete } from "@bookkeeping/application/testing/transaction-suite-fixture";
import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
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
import type { AppEnv } from "./request-context.js";

const { withRollback } = setupTestDatabase();

const UNKNOWN_ID = "01999999-0000-7000-8000-000000000000";
const MALFORMED_ID = "not-a-uuid";

/**
 * A resource an owner holds, created for the tests of every route that
 * addresses it by id. `retire` soft-deletes it where the app keeps the row.
 */
interface Resource {
  create: (db: Database, ownerId: string) => Promise<string>;
  retire?: (db: Database, id: string) => Promise<void>;
}

async function createCategorizedOwnerFixture(db: Database, ownerId: string) {
  await initializeDefaultCategories(db, ownerId);
  const tree = await listCategories(db, ownerId);
  const groceries = tree.find((category) => category.name === "Groceries");
  if (!groceries) {
    throw new Error("Missing default categories");
  }
  return {
    walletId: (
      await createWalletForTest(db, {
        ownerId,
        name: "Cash",
        type: "cash",
        openingAmount: 0n,
      })
    ).id,
    categoryId: groceries.id,
  };
}

const RESOURCES = {
  wallet: {
    create: async (db, ownerId) =>
      (
        await createWalletForTest(db, {
          ownerId,
          name: "Cash",
          type: "cash",
          openingAmount: 0n,
        })
      ).id,
  },
  tag: {
    create: (db, ownerId) => createTagForTest(db, { ownerId, name: "Coffee" }),
  },
  category: {
    create: async (db, ownerId) =>
      (await createCategorizedOwnerFixture(db, ownerId)).categoryId,
  },
  transaction: {
    create: async (db, ownerId) => {
      const { walletId, categoryId } = await createCategorizedOwnerFixture(
        db,
        ownerId,
      );
      return insertTransaction(db, {
        ownerId,
        type: "expense",
        walletId,
        categoryId,
      });
    },
    retire: softDelete,
  },
} satisfies Record<string, Resource>;

type ResourceName = keyof typeof RESOURCES;

/** One route that addresses a resource by id, and the request that reaches it. */
interface Endpoint {
  title: string;
  resource: ResourceName;
  method: "GET" | "PUT" | "PATCH" | "DELETE";
  path: (id: string) => string;
  body?: unknown;
}

const READS: readonly Endpoint[] = [
  {
    title: "GET /v1/wallets/{walletId}",
    resource: "wallet",
    method: "GET",
    path: (id) => `/wallets/${id}`,
  },
  {
    title: "GET /v1/categories/{categoryId}",
    resource: "category",
    method: "GET",
    path: (id) => `/categories/${id}`,
  },
  {
    title: "GET /v1/categories/{categoryId}/usage",
    resource: "category",
    method: "GET",
    path: (id) => `/categories/${id}/usage`,
  },
  {
    title: "GET /v1/transactions/{transactionId}",
    resource: "transaction",
    method: "GET",
    path: (id) => `/transactions/${id}`,
  },
  {
    title: "GET /v1/transactions/{transactionId}/refunds",
    resource: "transaction",
    method: "GET",
    path: (id) => `/transactions/${id}/refunds`,
  },
];

// A correction's body is read before the resource is, so it must be valid;
// the ids it names never matter because the resource is not found first.
const CORRECTIONS: readonly Endpoint[] = [
  {
    title: "PATCH /v1/tags/{tagId}",
    resource: "tag",
    method: "PATCH",
    path: (id) => `/tags/${id}`,
    body: { name: "Mine" },
  },
  {
    title: "PUT /v1/wallets/{walletId}/opening",
    resource: "wallet",
    method: "PUT",
    path: (id) => `/wallets/${id}/opening`,
    body: { amount: { value: "10.00", currency: "THB" }, date: "2026-09-02" },
  },
  {
    title: "PATCH /v1/wallets/{walletId}",
    resource: "wallet",
    method: "PATCH",
    path: (id) => `/wallets/${id}`,
    body: { archived: true },
  },
  {
    title: "PATCH /v1/categories/{categoryId}",
    resource: "category",
    method: "PATCH",
    path: (id) => `/categories/${id}`,
    body: { name: "Mine", iconId: "wine" },
  },
  {
    title: "PUT /v1/transactions/{transactionId}",
    resource: "transaction",
    method: "PUT",
    path: (id) => `/transactions/${id}`,
    body: {
      amount: { value: "10.00", currency: "THB" },
      walletId: UNKNOWN_ID,
      categoryId: UNKNOWN_ID,
      transactionDate: "2026-09-02",
      note: "",
      tagIds: [],
    },
  },
];

const REMOVALS: readonly Endpoint[] = [
  {
    title: "DELETE /v1/tags/{tagId}",
    resource: "tag",
    method: "DELETE",
    path: (id) => `/tags/${id}`,
  },
  {
    title: "DELETE /v1/wallets/{walletId}",
    resource: "wallet",
    method: "DELETE",
    path: (id) => `/wallets/${id}`,
  },
  {
    title: "DELETE /v1/categories/{categoryId}",
    resource: "category",
    method: "DELETE",
    path: (id) => `/categories/${id}`,
  },
  {
    title: "DELETE /v1/transactions/{transactionId}",
    resource: "transaction",
    method: "DELETE",
    path: (id) => `/transactions/${id}`,
  },
];

interface Attempt {
  endpoint: Readonly<Endpoint>;
  id: string;
  cookie: string;
}

function send(
  app: Readonly<Hono<AppEnv>>,
  { endpoint, id, cookie }: Readonly<Attempt>,
) {
  return app.request(`${TEST_API_ORIGIN}/v1${endpoint.path(id)}`, {
    method: endpoint.method,
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      cookie,
      ...(endpoint.body === undefined
        ? {}
        : { "content-type": "application/json" }),
    },
    ...(endpoint.body === undefined
      ? {}
      : { body: JSON.stringify(endpoint.body) }),
  });
}

/**
 * Every id the caller cannot reach answers the same 404 `not-found`: one the
 * owner never had, another owner's, a malformed one, and, for a resource the
 * app keeps, one the owner deleted (a removal repeats instead). Only the owner's own answer differs.
 */
async function expectNotFoundAlike(endpoint: Readonly<Endpoint>) {
  await withRollback(async (db) => {
    const app = createIntegrationTestApp(db, {
      auth: createTestAuthGateway(db),
    });
    const owner = await createOwnerSession(db);
    const stranger = await createOwnerSession(db);
    const resource: Resource = RESOURCES[endpoint.resource];
    const id = await resource.create(db, owner.ownerId);

    for (const unreachable of [UNKNOWN_ID, MALFORMED_ID, id]) {
      await expectProblem(
        await send(app, {
          endpoint,
          id: unreachable,
          cookie: stranger.cookie,
        }),
        { status: 404, code: "not-found" },
      );
    }
    // Repeating a removal is the same outcome, so a removal has no deleted case.
    if (resource.retire && endpoint.method !== "DELETE") {
      expect(
        (await send(app, { endpoint, id, cookie: owner.cookie })).status,
      ).not.toBe(404);
      await resource.retire(db, id);
      await expectProblem(
        await send(app, { endpoint, id, cookie: owner.cookie }),
        { status: 404, code: "not-found" },
      );
    }
  });
}

describe("not found alike", () => {
  describe("a read", () => {
    test.each(READS)("$title", expectNotFoundAlike);
  });

  describe("a correction", () => {
    test.each(CORRECTIONS)("$title", expectNotFoundAlike);
  });

  describe("a removal", () => {
    test.each(REMOVALS)("$title", expectNotFoundAlike);
  });
});
