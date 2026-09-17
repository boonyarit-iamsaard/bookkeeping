import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq } from "drizzle-orm";
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
  walletCollectionResponseSchema,
  walletResponseSchema,
} from "./wallet.routes.js";

const { withRollback, committed } = setupTestDatabase();

const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;
const UNKNOWN_WALLET_ID = "01999999-0000-7000-8000-000000000000";

const sessionResponseSchema = z.object({ user: z.object({ id: z.string() }) });

/** Signs up through the auth routes and returns the cookie plus the owner's id. */
async function signUp(app: Hono<AppEnv>) {
  const { cookie } = await signUpThroughAuthRoutes(app, "wallets");
  const session = await app.request(`${TEST_API_ORIGIN}/api/auth/get-session`, {
    headers: { cookie, origin: TEST_CLIENT_ORIGIN },
  });
  const { user } = sessionResponseSchema.parse(await session.json());
  return { cookie, ownerId: user.id };
}

interface WalletFixture {
  ownerId: string;
  name: string;
  type: WalletType;
  openingAmount: bigint;
  openingDate: CalendarDate;
}

/** Persists a wallet row directly; creation over HTTP has its own ticket. */
async function insertWallet(db: Database, fixture: Readonly<WalletFixture>) {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: fixture.ownerId,
      name: fixture.name,
      type: fixture.type,
      currency: "THB",
      openingAmount: fixture.openingAmount,
      openingDate: fixture.openingDate,
    })
    .returning({ id: wallets.id });
  return row.id;
}

function getWallets(app: Hono<AppEnv>, cookie?: string) {
  return app.request(WALLETS_URL, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface GetWalletRequest {
  id: string;
  cookie?: string;
}

function getWallet(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<GetWalletRequest>,
) {
  return app.request(`${WALLETS_URL}/${id}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

async function expectNotFoundProblem(response: Response) {
  expect(response.status).toBe(404);
  expect(response.headers.get("content-type")).toContain(
    "application/problem+json",
  );
  const problem = problemDetailsSchema.parse(await response.json());
  expect(problem.code).toBe("not-found");
  expect(problem.detail).toBeUndefined();
}

describe("GET /v1/wallets", () => {
  test("lists the signed-in owner's wallets with exact money in creation order", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      const bigId = await insertWallet(db, {
        ownerId,
        name: "Big",
        type: "bank_account",
        openingAmount: 9_999_999_999_999_999n,
        openingDate: "2026-09-01",
      });
      const overdrawnId = await insertWallet(db, {
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
            balance: { value: "-120.50", currency: "THB" },
          },
        ],
        page: { nextCursor: null },
      });
    });
  });

  test("an owner with no wallets receives an empty collection", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      const response = await getWallets(app, cookie);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        items: [],
        page: { nextCursor: null },
      });
    });
  });

  test("never lists another owner's wallets", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      await insertWallet(db, {
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
      const response = await getWallets(createIntegrationTestApp(db));

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });
});

describe("GET /v1/wallets/{walletId}", () => {
  test("returns the owner's wallet with its archived instant", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUp(app);
      const id = await insertWallet(db, {
        ownerId,
        name: "Old cash",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const archivedAt = new Date("2026-09-10T03:04:05.000Z");
      await db.update(wallets).set({ archivedAt }).where(eq(wallets.id, id));

      const response = await getWallet(app, { id, cookie });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(wallet).toEqual({
        id,
        name: "Old cash",
        type: "cash",
        currency: "THB",
        openingAmount: { value: "2.50", currency: "THB" },
        openingDate: "2026-09-01",
        archivedAt: "2026-09-10T03:04:05.000Z",
        balance: { value: "2.50", currency: "THB" },
      });
    });
  });

  test("another owner's wallet is not found, indistinguishably from a missing or malformed id", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUp(app);
      const bob = await signUp(app);
      const id = await insertWallet(db, {
        ownerId: alice.ownerId,
        name: "Alice cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });

      await expectNotFoundProblem(
        await getWallet(app, { id, cookie: bob.cookie }),
      );
      await expectNotFoundProblem(
        await getWallet(app, { id: UNKNOWN_WALLET_ID, cookie: bob.cookie }),
      );
      await expectNotFoundProblem(
        await getWallet(app, { id: "not-a-wallet", cookie: bob.cookie }),
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await getWallet(createIntegrationTestApp(db), {
        id: UNKNOWN_WALLET_ID,
      });

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });
});

interface CreateWalletRequest {
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
  rawBody?: string;
}

const SAVINGS_REQUEST = {
  name: "Kasikorn savings",
  type: "bank_account",
  openingAmount: { value: "12000.5", currency: "THB" },
  openingDate: "2026-09-01",
};

function postWallet(
  app: Hono<AppEnv>,
  {
    cookie,
    idempotencyKey,
    body = SAVINGS_REQUEST,
    rawBody,
  }: Readonly<CreateWalletRequest>,
) {
  return app.request(WALLETS_URL, {
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

async function listWalletItems(app: Hono<AppEnv>, cookie: string) {
  const response = await getWallets(app, cookie);
  return walletCollectionResponseSchema.parse(await response.json()).items;
}

describe("POST /v1/wallets", () => {
  test("creates the wallet and answers with its representation and location", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      const response = await postWallet(app, { cookie, idempotencyKey: "k1" });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(response.headers.get("location")).toBe(`/v1/wallets/${wallet.id}`);
      expect(wallet).toEqual({
        id: wallet.id,
        name: "Kasikorn savings",
        type: "bank_account",
        currency: "THB",
        openingAmount: { value: "12000.50", currency: "THB" },
        openingDate: "2026-09-01",
        archivedAt: null,
        balance: { value: "12000.50", currency: "THB" },
      });
      const located = await app.request(
        `${TEST_API_ORIGIN}${response.headers.get("location")}`,
        { headers: { cookie, origin: TEST_CLIENT_ORIGIN } },
      );
      expect(await located.json()).toEqual(wallet);
    });
  });

  test("a retry with the same key and payload replays the original creation", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      const first = await postWallet(app, { cookie, idempotencyKey: "retry" });
      const original = await first.json();

      const retry = await postWallet(app, {
        cookie,
        idempotencyKey: "retry",
        // The same amount spelled differently is the same validated payload.
        body: {
          ...SAVINGS_REQUEST,
          openingAmount: { value: "12000.50", currency: "THB" },
        },
      });

      expect(retry.status).toBe(201);
      expect(retry.headers.get("location")).toBe(first.headers.get("location"));
      expect(await retry.json()).toEqual(original);
      expect(await listWalletItems(app, cookie)).toEqual([original]);
    });
  });

  test("the same key with a different payload conflicts and creates nothing more", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);
      await postWallet(app, { cookie, idempotencyKey: "changed" });

      const conflict = await postWallet(app, {
        cookie,
        idempotencyKey: "changed",
        body: { ...SAVINGS_REQUEST, name: "Kasikorn current" },
      });

      await expectProblem(conflict, {
        status: 409,
        code: "idempotency-conflict",
      });
      expect(await listWalletItems(app, cookie)).toHaveLength(1);
    });
  });

  test("distinct keys open distinct wallets from the same payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      await postWallet(app, { cookie, idempotencyKey: "one" });
      await postWallet(app, { cookie, idempotencyKey: "two" });

      expect(await listWalletItems(app, cookie)).toHaveLength(2);
    });
  });

  test("concurrent retries create one wallet and answer every request alike", async () => {
    const app = createIntegrationTestApp(committed());
    const { cookie } = await signUp(app);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        postWallet(app, { cookie, idempotencyKey: "concurrent" }),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
    expect(await listWalletItems(app, cookie)).toHaveLength(1);
  });

  test("a missing, blank, or over-long Idempotency-Key is a bad request that creates nothing", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      await expectProblem(await postWallet(app, { cookie }), {
        status: 400,
        code: "idempotency-key-required",
      });
      await expectProblem(
        await postWallet(app, { cookie, idempotencyKey: "   " }),
        { status: 400, code: "idempotency-key-required" },
      );
      await expectProblem(
        await postWallet(app, { cookie, idempotencyKey: "k".repeat(256) }),
        { status: 400, code: "idempotency-key-required" },
      );
      expect(await listWalletItems(app, cookie)).toEqual([]);
    });
  });

  test("a malformed body is rejected field by field and does not consume the key", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      const rejected = await postWallet(app, {
        cookie,
        idempotencyKey: "corrected-later",
        body: {
          name: 7,
          type: "piggy_bank",
          openingAmount: { value: "1,000", currency: "USD" },
          openingDate: "1 Sep 2026",
        },
      });
      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/name", code: "invalid-type" },
        { pointer: "#/type", code: "invalid-value" },
        { pointer: "#/openingAmount/value", code: "invalid-format" },
        { pointer: "#/openingAmount/currency", code: "invalid-value" },
        { pointer: "#/openingDate", code: "invalid-format" },
      ]);

      const corrected = await postWallet(app, {
        cookie,
        idempotencyKey: "corrected-later",
      });
      expect(corrected.status).toBe(201);
    });
  });

  test("a well-formed command the application rejects is addressed by field", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      const rejected = await postWallet(app, {
        cookie,
        idempotencyKey: "invalid-wallet",
        body: { ...SAVINGS_REQUEST, name: "   ", openingDate: "2999-01-01" },
      });

      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/name", code: "empty" },
        { pointer: "#/openingDate", code: "in-future" },
      ]);
      expect(await listWalletItems(app, cookie)).toEqual([]);
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUp(app);

      await expectProblem(
        await postWallet(app, { cookie, idempotencyKey: "json", rawBody: "{" }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await postWallet(createIntegrationTestApp(db), {
        idempotencyKey: "anonymous",
      });

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});
