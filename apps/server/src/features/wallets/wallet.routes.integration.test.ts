import {
  insertRetainedTransferSnapshot,
  insertTransaction,
} from "@bookkeeping/application/testing/transaction-fixture";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { walletChanges, wallets } from "@bookkeeping/database/wallets";
import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { problemDetailsSchema } from "../../core/http/problem-details.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  signUpWithSession,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  walletCollectionResponseSchema,
  walletResponseSchema,
} from "./wallet.routes.js";

const { withRollback, committed } = setupTestDatabase();

const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;
const UNKNOWN_WALLET_ID = "01999999-0000-7000-8000-000000000000";

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

describe("GET /v1/wallets", () => {
  test("lists the signed-in owner's wallets with exact money in creation order", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
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
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const alice = await signUpWithSession(app, "wallets");
      const bob = await signUpWithSession(app, "wallets");
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

  test("an as-of date reports the end-of-day balance on that date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
      const id = await insertWallet(db, {
        ownerId,
        name: "Cash",
        type: "cash",
        openingAmount: 120_000n,
        openingDate: "2026-09-02",
      });
      const savingsId = await insertWallet(db, {
        ownerId,
        name: "Savings",
        type: "bank_account",
        openingAmount: 0n,
        openingDate: "2026-09-02",
      });
      await insertTransaction(db, {
        ownerId,
        type: "transfer",
        walletId: id,
        destinationWalletId: savingsId,
        amount: 50_000n,
        transactionDate: "2026-09-05",
      });

      async function balanceOn(asOf: string) {
        const response = await getWalletsAsOf(app, { asOf, cookie });
        const body = walletCollectionResponseSchema.parse(
          await response.json(),
        );
        return body.items[0]?.balance.value;
      }

      // Before the opening date the wallet holds nothing; the opening
      // amount counts from its own date, and later movements from theirs.
      expect(await balanceOn("2026-09-01")).toBe("0.00");
      expect(await balanceOn("2026-09-02")).toBe("1200.00");
      expect(await balanceOn("2026-09-04")).toBe("1200.00");
      expect(await balanceOn("2026-09-05")).toBe("700.00");
    });
  });

  test("a malformed as-of date is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");

      const response = await app.request(`${WALLETS_URL}?archived=true`, {
        headers: { origin: TEST_CLIENT_ORIGIN, cookie },
      });

      await expectProblem(response, { status: 400, code: "bad-request" });
    });
  });
});

describe("GET /v1/wallets/{walletId}", () => {
  test("returns the owner's wallet with its archived instant", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
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
      const alice = await signUpWithSession(app, "wallets");
      const bob = await signUpWithSession(app, "wallets");
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

async function listWalletItems(app: Hono<AppEnv>, cookie: string) {
  const response = await getWallets(app, cookie);
  return walletCollectionResponseSchema.parse(await response.json()).items;
}

describe("POST /v1/wallets", () => {
  test("creates the wallet and answers with its representation and location", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const { cookie } = await signUpWithSession(app, "wallets");
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
      const { cookie } = await signUpWithSession(app, "wallets");
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
      const { cookie } = await signUpWithSession(app, "wallets");

      await postWallet(app, { cookie, idempotencyKey: "one" });
      await postWallet(app, { cookie, idempotencyKey: "two" });

      expect(await listWalletItems(app, cookie)).toHaveLength(2);
    });
  });

  test("concurrent retries create one wallet and answer every request alike", async () => {
    const app = createIntegrationTestApp(committed());
    const { cookie } = await signUpWithSession(app, "wallets");

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
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const { cookie } = await signUpWithSession(app, "wallets");

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

async function listWalletChangeActions(db: Database, walletId: string) {
  return db
    .select({ action: walletChanges.action })
    .from(walletChanges)
    .where(eq(walletChanges.walletId, walletId));
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
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
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
      expect(await listWalletChangeActions(db, created.id)).toEqual([
        { action: "opening" },
      ]);
    });
  });

  test("repeating the same replacement answers alike and records nothing more", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
      const created = await createSavingsWallet(app, cookie);

      const first = await putWalletOpening(app, { id: created.id, cookie });
      const second = await putWalletOpening(app, {
        id: created.id,
        cookie,
        body: {
          ...OPENING_REQUEST,
          amount: { value: "-250.50", currency: "THB" },
        },
      });

      expect(second.status).toBe(200);
      expect(await second.json()).toEqual(await first.json());
      expect(await listWalletChangeActions(db, created.id)).toHaveLength(1);
    });
  });

  test("a malformed body is rejected field by field", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
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
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
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
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(
        created,
      );
    });
  });

  test("a movement before the proposed opening, even a deleted one, is addressed to the date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
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
      const accepted = await putWalletOpening(app, { id: cash.id, cookie });
      expect(accepted.status).toBe(200);
    });
  });

  test("another owner's wallet is not found, indistinguishably from a missing or malformed id", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUpWithSession(app, "wallets");
      const bob = await signUpWithSession(app, "wallets");
      const wallet = await createSavingsWallet(app, alice.cookie);

      for (const id of [wallet.id, UNKNOWN_WALLET_ID, "not-a-wallet"]) {
        await expectNotFoundProblem(
          await putWalletOpening(app, { id, cookie: bob.cookie }),
        );
      }
      expect(
        await readWallet(app, { id: wallet.id, cookie: alice.cookie }),
      ).toEqual(wallet);
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");

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
      const response = await putWalletOpening(createIntegrationTestApp(db), {
        id: UNKNOWN_WALLET_ID,
      });

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
  test("archives and answers with the updated wallet", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
      const created = await createSavingsWallet(app, cookie);

      const response = await patchWallet(app, { id: created.id, cookie });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(wallet.archivedAt).toEqual(expect.any(String));
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(wallet);
      expect(await listWalletChangeActions(db, created.id)).toEqual([
        { action: "archive" },
      ]);
    });
  });

  test("restores by clearing the archived instant", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
      const created = await createSavingsWallet(app, cookie);
      await patchWallet(app, { id: created.id, cookie });

      const response = await patchWallet(app, {
        id: created.id,
        cookie,
        body: { archived: false },
      });
      const wallet = walletResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(wallet.archivedAt).toBeNull();
      expect(await listWalletChangeActions(db, created.id)).toEqual([
        { action: "archive" },
        { action: "unarchive" },
      ]);
    });
  });

  test("repeating the same state answers alike and records nothing more", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
      const created = await createSavingsWallet(app, cookie);

      const first = await patchWallet(app, { id: created.id, cookie });
      const second = await patchWallet(app, { id: created.id, cookie });

      expect(second.status).toBe(200);
      expect(await second.json()).toEqual(await first.json());
      expect(await listWalletChangeActions(db, created.id)).toHaveLength(1);
    });
  });

  test("a malformed or unrelated body is rejected field by field", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");
      const created = await createSavingsWallet(app, cookie);

      const rejected = await patchWallet(app, {
        id: created.id,
        cookie,
        body: { archived: "yes", name: "Renamed" },
      });

      const problem = await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/archived", code: "invalid-type" },
        // An unknown field has no defined pointer, so it addresses the
        // document root.
        { pointer: "#/", code: "unrecognized-keys" },
      ]);
      expect(await readWallet(app, { id: created.id, cookie })).toEqual(
        created,
      );
    });
  });

  test("another owner's wallet is not found, indistinguishably from a missing or malformed id", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUpWithSession(app, "wallets");
      const bob = await signUpWithSession(app, "wallets");
      const wallet = await createSavingsWallet(app, alice.cookie);

      for (const id of [wallet.id, UNKNOWN_WALLET_ID, "not-a-wallet"]) {
        await expectNotFoundProblem(
          await patchWallet(app, { id, cookie: bob.cookie }),
        );
      }
      expect(
        await readWallet(app, { id: wallet.id, cookie: alice.cookie }),
      ).toEqual(wallet);
    });
  });

  test("malformed JSON is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "wallets");

      await expectProblem(
        await patchWallet(app, { id: UNKNOWN_WALLET_ID, cookie, rawBody: "{" }),
        { status: 400, code: "bad-request" },
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await patchWallet(createIntegrationTestApp(db), {
        id: UNKNOWN_WALLET_ID,
      });

      await expectProblem(response, { status: 401, code: "unauthenticated" });
    });
  });
});

describe("DELETE /v1/wallets/{walletId}", () => {
  test("deletes an eligible wallet with no response body and makes a repeat not found", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
      const id = await insertWallet(db, {
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

  test("returns one stable conflict problem for every retained-history blocker", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie, ownerId } = await signUpWithSession(app, "wallets");
      const currentId = await insertWallet(db, {
        ownerId,
        name: "Current movement",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const destinationId = await insertWallet(db, {
        ownerId,
        name: "Destination",
        type: "bank_account",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const changedId = await insertWallet(db, {
        ownerId,
        name: "Changed",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const retainedId = await insertWallet(db, {
        ownerId,
        name: "Retained",
        type: "cash",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const currentAfterEditId = await insertWallet(db, {
        ownerId,
        name: "Current after edit",
        type: "e_wallet",
        openingAmount: 250n,
        openingDate: "2026-09-01",
      });
      const currentAfterEditDestinationId = await insertWallet(db, {
        ownerId,
        name: "Current after edit destination",
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
      expect((await patchWallet(app, { id: changedId, cookie })).status).toBe(
        200,
      );
      await insertRetainedTransferSnapshot(db, {
        ownerId,
        currentWalletId: currentAfterEditId,
        currentDestinationWalletId: currentAfterEditDestinationId,
        retainedWalletId: retainedId,
      });

      for (const id of [currentId, changedId, retainedId]) {
        await expectProblem(await deleteWallet(app, { id, cookie }), {
          status: 409,
          code: "conflict",
        });
      }
    });
  });

  test("does not disclose missing or another owner's wallets", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const alice = await signUpWithSession(app, "wallets");
      const bob = await signUpWithSession(app, "wallets");
      const id = await insertWallet(db, {
        ownerId: alice.ownerId,
        name: "Alice cash",
        type: "cash",
        openingAmount: 50_000n,
        openingDate: "2026-09-01",
      });

      for (const attempt of [
        { id, cookie: bob.cookie },
        { id: UNKNOWN_WALLET_ID, cookie: bob.cookie },
        { id: "not-a-wallet", cookie: bob.cookie },
      ]) {
        await expectNotFoundProblem(await deleteWallet(app, attempt));
      }
      expect((await getWallet(app, { id, cookie: alice.cookie })).status).toBe(
        200,
      );
    });
  });

  test("rejects an anonymous request with the standard problem", async () => {
    await withRollback(async (db) => {
      const response = await deleteWallet(createIntegrationTestApp(db), {
        id: UNKNOWN_WALLET_ID,
      });

      await expectProblem(response, {
        status: 401,
        code: "unauthenticated",
      });
    });
  });
});
