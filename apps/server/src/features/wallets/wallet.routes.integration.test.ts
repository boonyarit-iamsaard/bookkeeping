import { createWalletForTest } from "@bookkeeping/application/testing/wallet-fixture";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import { eq } from "drizzle-orm";
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
  walletCollectionResponseSchema,
  walletResponseSchema,
} from "./wallet.routes.js";

const { withRollback } = setupTestDatabase();

const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;
const UNKNOWN_WALLET_ID = "01999999-0000-7000-8000-000000000000";

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

interface DeleteWalletRequest {
  id: string;
  cookie?: string;
}

function deleteWallet(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<DeleteWalletRequest>,
) {
  return app.request(`${WALLETS_URL}/${id}`, {
    method: "DELETE",
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

describe("GET /v1/wallets/{walletId}", () => {
  test("returns the owner's wallet with its archived instant", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      const { id } = await createWalletForTest(db, {
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
        savings: false,
        balance: { value: "2.50", currency: "THB" },
      });
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await getWallet(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          id: UNKNOWN_WALLET_ID,
        },
      );

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

async function listWalletItems(app: Hono<AppEnv>, cookie: string) {
  const response = await getWallets(app, cookie);
  return walletCollectionResponseSchema.parse(await response.json()).items;
}

describe("POST /v1/wallets", () => {
  test("creates the wallet and answers with its representation and location", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      const response = await postWallet(app, {
        cookie,
        idempotencyKey: "k1",
        body: { ...SAVINGS_REQUEST, savings: true },
      });
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
        savings: true,
        balance: { value: "12000.50", currency: "THB" },
      });
      const located = await app.request(
        `${TEST_API_ORIGIN}${response.headers.get("location")}`,
        { headers: { cookie, origin: TEST_CLIENT_ORIGIN } },
      );
      expect(await located.json()).toEqual(wallet);
    });
  });

  test("replays the original creation for a retried key and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const first = await postWallet(app, { cookie, idempotencyKey: "retry" });
      const original = walletResponseSchema.parse(await first.json());
      expect(original.savings).toBe(false);

      const retry = await postWallet(app, {
        cookie,
        idempotencyKey: "retry",
        // The same amount spelled differently is the same validated payload.
        body: {
          ...SAVINGS_REQUEST,
          openingAmount: { value: "12000.50", currency: "THB" },
        },
      });
      const conflict = await postWallet(app, {
        cookie,
        idempotencyKey: "retry",
        body: { ...SAVINGS_REQUEST, name: "Kasikorn current" },
      });

      expect(retry.status).toBe(201);
      expect(retry.headers.get("location")).toBe(first.headers.get("location"));
      expect(await retry.json()).toEqual(original);
      await expectProblem(conflict, {
        status: 409,
        code: "idempotency-conflict",
      });
      expect(await listWalletItems(app, cookie)).toEqual([original]);
    });
  });

  test("a missing, blank, or over-long Idempotency-Key is a bad request that creates nothing", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      const rejected = await postWallet(app, {
        cookie,
        idempotencyKey: "corrected-later",
        body: {
          name: 7,
          type: "piggy_bank",
          openingAmount: { value: "1,000", currency: "USD" },
          openingDate: "1 Sep 2026",
          savings: "yes",
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
        { pointer: "#/savings", code: "invalid-type" },
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
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

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
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      await expectProblem(
        await postWallet(app, { cookie, idempotencyKey: "json", rawBody: "{" }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await postWallet(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          idempotencyKey: "anonymous",
        },
      );

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

interface PutWalletOpeningRequest {
  id: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

const OPENING_REQUEST = {
  amount: { value: "-250.5", currency: "THB" },
  date: "2026-09-02",
};

function putWalletOpening(
  app: Hono<AppEnv>,
  {
    id,
    cookie,
    body = OPENING_REQUEST,
    rawBody,
  }: Readonly<PutWalletOpeningRequest>,
) {
  return app.request(`${WALLETS_URL}/${id}/opening`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

interface TransferFixture {
  ownerId: string;
  walletId: string;
  destinationWalletId: string;
  transactionDate: CalendarDate;
  deletedAt?: Date;
}

/** Persists a transfer row directly; transfers over HTTP have their own ticket. */
async function insertTransfer(
  db: Database,
  fixture: Readonly<TransferFixture>,
) {
  await db.insert(transactions).values({
    userId: fixture.ownerId,
    type: "transfer",
    walletId: fixture.walletId,
    destinationWalletId: fixture.destinationWalletId,
    currency: "THB",
    amount: 100n,
    transactionDate: fixture.transactionDate,
    deletedAt: fixture.deletedAt,
  });
}

async function createSavingsWallet(app: Hono<AppEnv>, cookie: string) {
  const response = await postWallet(app, {
    cookie,
    idempotencyKey: crypto.randomUUID(),
  });
  return walletResponseSchema.parse(await response.json());
}

async function readWallet(
  app: Hono<AppEnv>,
  request: Readonly<Required<GetWalletRequest>>,
) {
  const response = await getWallet(app, request);
  return walletResponseSchema.parse(await response.json());
}

describe("PUT /v1/wallets/{walletId}/opening", () => {
  test("replaces the opening and answers with the updated wallet", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const created = await createSavingsWallet(app, cookie);

      const response = await putWalletOpening(app, { id: created.id, cookie });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(wallet).toEqual({
        ...created,
        openingAmount: { value: "-250.50", currency: "THB" },
        openingDate: "2026-09-02",
        balance: { value: "-250.50", currency: "THB" },
      });
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(wallet);
    });
  });

  test("a malformed body is rejected field by field", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const created = await createSavingsWallet(app, cookie);

      const rejected = await putWalletOpening(app, {
        id: created.id,
        cookie,
        body: {
          amount: { value: "1,000", currency: "USD" },
          date: "2 Sep 2026",
        },
      });

      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/amount/value", code: "invalid-format" },
        { pointer: "#/amount/currency", code: "invalid-value" },
        { pointer: "#/date", code: "invalid-format" },
      ]);
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(
        created,
      );
    });
  });

  test("an opening the application rejects is addressed by field", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const created = await createSavingsWallet(app, cookie);

      // The money grammar already caps whole digits, so a future date is
      // the only application rejection reachable over HTTP.
      const rejected = await putWalletOpening(app, {
        id: created.id,
        cookie,
        body: { ...OPENING_REQUEST, date: "2999-01-01" },
      });

      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/date", code: "in-future" },
      ]);
    });
  });

  test("a movement before the proposed opening, even a deleted one, is addressed to the date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      const cash = await createSavingsWallet(app, cookie);
      const bank = await createSavingsWallet(app, cookie);
      await insertTransfer(db, {
        ownerId,
        walletId: cash.id,
        destinationWalletId: bank.id,
        transactionDate: "2026-09-02",
        deletedAt: new Date("2026-09-03T00:00:00Z"),
      });

      for (const id of [cash.id, bank.id]) {
        const rejected = await putWalletOpening(app, {
          id,
          cookie,
          body: { ...OPENING_REQUEST, date: "2026-09-03" },
        });
        const problem = await expectProblem(rejected, {
          status: 422,
          code: "invalid-command",
        });
        expect(problem.errors).toEqual([
          { pointer: "#/date", code: "movement-before-opening" },
        ]);
      }
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      await expectProblem(
        await putWalletOpening(app, {
          id: UNKNOWN_WALLET_ID,
          cookie,
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await putWalletOpening(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          id: UNKNOWN_WALLET_ID,
        },
      );

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

interface PatchWalletRequest {
  id: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

function patchWallet(
  app: Hono<AppEnv>,
  { id, cookie, body, rawBody }: Readonly<PatchWalletRequest>,
) {
  return app.request(`${WALLETS_URL}/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody ?? JSON.stringify(body ?? { archived: true }),
  });
}

describe("PATCH /v1/wallets/{walletId}", () => {
  test("archives, then marks savings through partial updates", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const created = await createSavingsWallet(app, cookie);

      const response = await patchWallet(app, { id: created.id, cookie });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(wallet.archivedAt).toEqual(expect.any(String));
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(wallet);

      const marked = await patchWallet(app, {
        id: created.id,
        cookie,
        body: { savings: true },
      });
      const savingsWallet = walletResponseSchema.parse(await marked.json());
      expect(marked.status).toBe(200);
      expect(savingsWallet.savings).toBe(true);
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(
        savingsWallet,
      );
    });
  });

  test("rejects malformed, unrelated, and empty state bodies", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);
      const created = await createSavingsWallet(app, cookie);

      const rejected = await patchWallet(app, {
        id: created.id,
        cookie,
        body: { archived: "yes", savings: "yes", name: "Renamed" },
      });

      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/archived", code: "invalid-type" },
        { pointer: "#/savings", code: "invalid-type" },
        { pointer: "#/", code: "unrecognized-keys" },
      ]);
      const empty = await expectProblem(
        await patchWallet(app, { id: created.id, cookie, body: {} }),
        { status: 422, code: "invalid-command" },
      );
      expect(empty.errors).toEqual([{ pointer: "#/", code: "invalid" }]);
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(
        created,
      );
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createOwnerSession(db);

      await expectProblem(
        await patchWallet(app, { id: UNKNOWN_WALLET_ID, cookie, rawBody: "{" }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await patchWallet(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          id: UNKNOWN_WALLET_ID,
        },
      );

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

describe("DELETE /v1/wallets/{walletId}", () => {
  test("deletes an eligible wallet with no response body and makes a repeat not found", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      const { id } = await createWalletForTest(db, {
        ownerId,
        name: "Disposable cash",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });

      const response = await deleteWallet(app, { id, cookie });

      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");
      await expectNotFoundProblem(await deleteWallet(app, { id, cookie }));
    });
  });

  test("maps retained history to a conflict problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      const { id: currentId } = await createWalletForTest(db, {
        ownerId,
        name: "Current movement",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const { id: destinationId } = await createWalletForTest(db, {
        ownerId,
        name: "Destination",
        type: "bank_account",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      await insertTransfer(db, {
        ownerId,
        walletId: currentId,
        destinationWalletId: destinationId,
        transactionDate: "2026-09-02",
      });
      await expectProblem(await deleteWallet(app, { id: currentId, cookie }), {
        status: 409,
        code: "history-remains",
      });
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await deleteWallet(
        createIntegrationTestApp(db, { auth: createTestAuthGateway(db) }),
        {
          id: UNKNOWN_WALLET_ID,
        },
      );

      await expectProblem(response, {
        status: 401,
        code: "unauthenticated",
      });
    });
  });
});
