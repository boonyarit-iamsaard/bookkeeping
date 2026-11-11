import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import { setupTestDatabase } from "@bookkeeping/database/testing";
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
import { walletCollectionResponseSchema } from "./wallet.routes.js";

const { withRollback } = setupTestDatabase();

const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;

function getWallets(app: Hono<AppEnv>, cookie?: string) {
  return app.request(WALLETS_URL, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface WalletsAsOfRequest {
  asOf: string;
  cookie: string;
}

function getWalletsAsOf(
  app: Hono<AppEnv>,
  { asOf, cookie }: Readonly<WalletsAsOfRequest>,
) {
  return app.request(`${WALLETS_URL}?asOf=${encodeURIComponent(asOf)}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
}

describe("GET /v1/wallets", () => {
  test("lists the signed-in owner's wallets with exact money in creation order", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      const { id: bigId } = await createWalletForTest(db, {
        ownerId,
        name: "Big",
        type: "bank_account",
        openingAmount: 9_999_999_999_999_999n,
        openingDate: "2026-09-01",
      });
      const { id: overdrawnId } = await createWalletForTest(db, {
        ownerId,
        name: "Overdrawn",
        type: "e_wallet",
        openingAmount: -12_050n,
        openingDate: "2026-09-01",
      });

      const response = await getWallets(app, cookie);
      const body = walletCollectionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(body).toEqual({
        items: [
          {
            id: bigId,
            name: "Big",
            type: "bank_account",
            currency: "THB",
            openingAmount: { value: "99999999999999.99", currency: "THB" },
            openingDate: "2026-09-01",
            archivedAt: null,
            savings: false,
            balance: { value: "99999999999999.99", currency: "THB" },
          },
          {
            id: overdrawnId,
            name: "Overdrawn",
            type: "e_wallet",
            currency: "THB",
            openingAmount: { value: "-120.50", currency: "THB" },
            openingDate: "2026-09-01",
            archivedAt: null,
            savings: false,
            balance: { value: "-120.50", currency: "THB" },
          },
        ],
        page: { nextCursor: null },
        balance: {
          total: { value: "99999999999879.49", currency: "THB" },
          spendable: { value: "99999999999879.49", currency: "THB" },
          setAside: null,
          walletCount: 2,
          spendableWalletCount: 2,
          savingsWalletCount: 0,
        },
      });
    });
  });

  test("an as-of date leaves out wallets not yet opened and has no figure for a kind with none", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      await createWalletForTest(db, {
        ownerId,
        name: "Cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });
      await createWalletForTest(db, {
        ownerId,
        name: "Rainy day",
        type: "bank_account",
        openingAmount: 100_000n,
        openingDate: "2026-09-10",
        savings: true,
      });

      const dated = walletCollectionResponseSchema.parse(
        await (
          await getWalletsAsOf(app, { asOf: "2026-09-05", cookie })
        ).json(),
      );
      expect(dated.items.map(({ name }) => name)).toEqual(["Cash"]);
      expect(dated.balance).toEqual({
        total: { value: "500.00", currency: "THB" },
        spendable: { value: "500.00", currency: "THB" },
        setAside: null,
        walletCount: 1,
        spendableWalletCount: 1,
        savingsWalletCount: 0,
      });

      const unopened = walletCollectionResponseSchema.parse(
        await (
          await getWalletsAsOf(app, { asOf: "2026-08-31", cookie })
        ).json(),
      );
      expect(unopened).toEqual({
        items: [],
        page: { nextCursor: null },
        balance: {
          total: null,
          spendable: null,
          setAside: null,
          walletCount: 0,
          spendableWalletCount: 0,
          savingsWalletCount: 0,
        },
      });
    });
  });

  test("never lists another owner's wallets", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const alice = await createOwnerSession(db);
      const bob = await createOwnerSession(db);
      await createWalletForTest(db, {
        ownerId: alice.ownerId,
        name: "Alice cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });

      const response = await getWallets(app, bob.cookie);
      const body = walletCollectionResponseSchema.parse(await response.json());

      expect(body.items).toEqual([]);
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await getWallets(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
      );

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });

  test("a malformed as-of date is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      for (const asOf of ["2026-02-30", "05-09-2026", ""]) {
        await expectProblem(await getWalletsAsOf(app, { asOf, cookie }), {
          status: 400,
          code: "bad-request",
        });
      }
    });
  });

  test("an unknown query parameter is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      const response = await app.request(`${WALLETS_URL}?archived=true`, {
        headers: { origin: TEST_CLIENT_ORIGIN, cookie },
      });

      await expectProblem(response, { status: 400, code: "bad-request" });
    });
  });
});
