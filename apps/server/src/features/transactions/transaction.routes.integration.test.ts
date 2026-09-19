import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { listTransactionChanges } from "@bookkeeping/application/transactions";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq, inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type * as z from "zod";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  signUpWithSession,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import { walletCollectionResponseSchema } from "../wallets/wallet.routes.js";
import type {
  createTransactionRequestSchema,
  updateTransactionRequestSchema,
} from "./transaction.routes.js";
import {
  transactionCollectionResponseSchema,
  transactionEntryDefaultsResponseSchema,
  transactionRefundsResponseSchema,
  transactionResponseSchema,
} from "./transaction.routes.js";

const { withRollback, committed } = setupTestDatabase();

const TRANSACTIONS_URL = `${TEST_API_ORIGIN}/v1/transactions`;
const WALLETS_URL = `${TEST_API_ORIGIN}/v1/wallets`;
const UNKNOWN_TRANSACTION_ID = "01999999-0000-7000-8000-000000000000";

interface WalletFixture {
  ownerId: string;
  name: string;
  type: WalletType;
  openingAmount?: bigint;
}

/** Persists a wallet row directly; creation over HTTP has its own ticket. */
async function insertWallet(
  db: Database,
  fixture: Readonly<WalletFixture>,
): Promise<string> {
  const [row] = await db
    .insert(wallets)
    .values({
      userId: fixture.ownerId,
      name: fixture.name,
      type: fixture.type,
      currency: "THB",
      openingAmount: fixture.openingAmount ?? 0n,
      openingDate: "2026-09-01",
    })
    .returning({ id: wallets.id });
  return row.id;
}

interface OwnerFixture {
  cookie: string;
  ownerId: string;
  cashId: string;
  bankId: string;
  parentId: string;
  childId: string;
  incomeId: string;
}

interface OwnerRequest {
  db: Database;
  label: string;
}

/** A fresh owner with two wallets and the default expense tree to file under. */
async function createOwner(
  app: Hono<AppEnv>,
  { db, label }: Readonly<OwnerRequest>,
): Promise<OwnerFixture> {
  const { cookie, ownerId } = await signUpWithSession(app, label);
  await initializeDefaultCategories(db, ownerId);
  const cashId = await insertWallet(db, {
    ownerId,
    name: "Cash",
    type: "cash",
    openingAmount: 1_000_000n,
  });
  const bankId = await insertWallet(db, {
    ownerId,
    name: "Bank",
    type: "bank_account",
  });
  const tree = await db
    .select({ id: categories.id, kind: categories.kind, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, ownerId));
  const parent = tree.find((category) => category.name === "Food & Drink");
  const child = tree.find((category) => category.name === "Groceries");
  const income = tree.find(
    (category) => category.kind === "income" && category.name === "Salary",
  );
  if (!parent || !child || !income) {
    throw new Error("Missing default categories");
  }
  return {
    cookie,
    ownerId,
    cashId,
    bankId,
    parentId: parent.id,
    childId: child.id,
    incomeId: income.id,
  };
}

async function softDelete(db: Database, id: string): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(eq(transactions.id, id));
}

interface ReadRequest {
  id: string;
  cookie?: string;
}

function getTransaction(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<ReadRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

function getTransactionRefunds(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<ReadRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}/refunds`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

function getEntryDefaults(app: Hono<AppEnv>, cookie?: string) {
  return app.request(`${TRANSACTIONS_URL}/entry-defaults`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

interface ListTransactionsRequest {
  cookie?: string;
  query?: string;
}

function listTransactions(
  app: Hono<AppEnv>,
  { cookie, query }: Readonly<ListTransactionsRequest> = {},
) {
  return app.request(`${TRANSACTIONS_URL}${query ? `?${query}` : ""}`, {
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

function listWallets(app: Readonly<Hono<AppEnv>>, cookie: string) {
  return app.request(WALLETS_URL, {
    headers: { origin: TEST_CLIENT_ORIGIN, cookie },
  });
}

interface CreateTransactionRequest {
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
  rawBody?: string;
}

function postTransaction(
  app: Hono<AppEnv>,
  {
    cookie,
    idempotencyKey,
    body = {},
    rawBody,
  }: Readonly<CreateTransactionRequest>,
) {
  return app.request(TRANSACTIONS_URL, {
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

type TransactionCreationBody = z.input<typeof createTransactionRequestSchema>;

function expenseBody(owner: Readonly<OwnerFixture>): TransactionCreationBody {
  return {
    type: "expense",
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    categoryId: owner.childId,
    transactionDate: "2026-09-02",
    note: "Lunch",
  };
}

function transferBody(owner: Readonly<OwnerFixture>) {
  return {
    type: "transfer",
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    destinationWalletId: owner.bankId,
    transactionDate: "2026-09-02",
    note: "Move money",
  } satisfies Extract<TransactionCreationBody, { type: "transfer" }>;
}

function refundBody(
  owner: Readonly<OwnerFixture>,
  expenseId: string,
): Extract<TransactionCreationBody, { type: "refund" }> {
  return {
    type: "refund",
    amount: { value: "20.00", currency: "THB" },
    walletId: owner.bankId,
    refundOfTransactionId: expenseId,
    transactionDate: "2026-09-03",
    note: "Returned",
  };
}

type TransactionUpdateBody = z.input<typeof updateTransactionRequestSchema>;

function updateExpenseBody(
  owner: Readonly<OwnerFixture>,
): TransactionUpdateBody {
  return {
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    categoryId: owner.childId,
    transactionDate: "2026-09-02",
    note: "Lunch",
  };
}

interface UpdateTransactionRequest {
  id: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

function putTransaction(
  app: Hono<AppEnv>,
  { id, cookie, body = {}, rawBody }: Readonly<UpdateTransactionRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

interface DeleteTransactionRequest {
  id: string;
  cookie?: string;
}

function deleteTransaction(
  app: Hono<AppEnv>,
  { id, cookie }: Readonly<DeleteTransactionRequest>,
) {
  return app.request(`${TRANSACTIONS_URL}/${id}`, {
    method: "DELETE",
    headers: { origin: TEST_CLIENT_ORIGIN, ...(cookie ? { cookie } : {}) },
  });
}

describe("POST /v1/transactions", () => {
  test("creates a transfer without category or refund fields and changes both balances", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "transfer-create" });
      const response = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "transfer-create",
        body: transferBody(owner),
      });
      const transfer = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("location")).toBe(
        `/v1/transactions/${transfer.id}`,
      );
      expect(transfer).toEqual({
        id: transfer.id,
        type: "transfer",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-02",
        note: "Move money",
        recordedAt: expect.any(String),
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        category: null,
        refundOf: null,
      });

      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9876.55", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "123.45", currency: "THB" },
          }),
        ]),
      );
    });
  });
  test("replays a transfer and conflicts when its payload changes", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "transfer-retry" });
      const body = {
        ...transferBody(owner),
        amount: { value: "123.4", currency: "THB" },
      };
      const firstResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "transfer-retry",
        body,
      });
      const first = transactionResponseSchema.parse(await firstResponse.json());

      const replayResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "transfer-retry",
        body: { ...body, amount: { value: "123.40", currency: "THB" } },
      });
      const replay = transactionResponseSchema.parse(
        await replayResponse.json(),
      );

      expect(firstResponse.status).toBe(201);
      expect(replayResponse.status).toBe(201);
      expect(replay).toEqual(first);
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-retry",
          body: { ...body, amount: { value: "124.40", currency: "THB" } },
        }),
        { status: 409, code: "idempotency-conflict" },
      );

      const transactionsResponse = await listTransactions(app, {
        cookie: owner.cookie,
      });
      const transactionCollection = transactionCollectionResponseSchema.parse(
        await transactionsResponse.json(),
      );
      expect(
        transactionCollection.items.filter(
          (transaction) => transaction.type === "transfer",
        ),
      ).toHaveLength(1);
      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9876.60", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "123.40", currency: "THB" },
          }),
        ]),
      );
    });
  });

  test("rejects invalid transfer shapes and maps ownership failures", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, {
        db,
        label: "transfer-validation",
      });
      const foreign = await createOwner(app, {
        db,
        label: "transfer-validation-foreign",
      });
      const body = transferBody(owner);

      const missingDestination = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-missing-destination",
          body: { ...body, destinationWalletId: undefined },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(missingDestination.errors).toEqual([
        { pointer: "#/destinationWalletId", code: "invalid-type" },
      ]);

      const category = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-category",
          body: { ...body, categoryId: owner.childId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(category.errors).toEqual([
        { pointer: "#/", code: "unrecognized-keys" },
      ]);

      const refund = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-refund",
          body: { ...body, refundOfTransactionId: owner.childId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(refund.errors).toEqual([
        { pointer: "#/", code: "unrecognized-keys" },
      ]);

      const sameWallet = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-same-wallet",
          body: { ...body, destinationWalletId: owner.cashId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(sameWallet.errors).toEqual([
        { pointer: "#/destinationWalletId", code: "same-wallet" },
      ]);

      const foreignSource = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-foreign-source",
          body: { ...body, walletId: foreign.cashId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(foreignSource.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-not-found" },
      ]);

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.cashId));
      const archivedSource = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-archived-source",
          body,
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(archivedSource.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-archived" },
      ]);
      await db
        .update(wallets)
        .set({ archivedAt: null })
        .where(eq(wallets.id, owner.cashId));

      const foreignDestination = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-foreign-destination",
          body: { ...body, destinationWalletId: foreign.bankId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(foreignDestination.errors).toEqual([
        {
          pointer: "#/destinationWalletId",
          code: "destination-wallet-not-found",
        },
      ]);

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));
      const archivedDestination = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-archived-destination",
          body,
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(archivedDestination.errors).toEqual([
        { pointer: "#/destinationWalletId", code: "wallet-archived" },
      ]);

      await db
        .update(wallets)
        .set({ archivedAt: null, openingDate: "2026-09-03" })
        .where(eq(wallets.id, owner.bankId));
      const beforeDestinationOpening = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-before-destination-opening",
          body,
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(beforeDestinationOpening.errors).toEqual([
        { pointer: "#/transactionDate", code: "before-opening" },
      ]);
    });
  });

  test("creates income and expense details with semantic money and locations", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "create-details" });
      const expenseResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "expense-create",
        body: expenseBody(owner),
      });
      const expense = transactionResponseSchema.parse(
        await expenseResponse.json(),
      );
      expect(expenseResponse.status).toBe(201);
      expect(expenseResponse.headers.get("location")).toBe(
        `/v1/transactions/${expense.id}`,
      );
      expect(expense).toEqual({
        id: expense.id,
        type: "expense",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-02",
        note: "Lunch",
        recordedAt: expect.any(String),
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: null,
      });

      const income = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "income-create",
            body: {
              ...expenseBody(owner),
              type: "income",
              amount: { value: "1000.10", currency: "THB" },
              walletId: owner.bankId,
              categoryId: owner.incomeId,
              note: "Salary",
            },
          })
        ).json(),
      );
      expect(income.type).toBe("income");
      expect(income.amount).toEqual({ value: "1000.10", currency: "THB" });
      expect(income.category?.id).toBe(owner.incomeId);
    });
  });

  test("replays normalized money and the original snapshot, and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "create-retry" });
      const originalBody = {
        ...expenseBody(owner),
        amount: { value: "123.4", currency: "THB" },
      };
      const firstResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: originalBody,
      });
      const first = transactionResponseSchema.parse(await firstResponse.json());
      const malformedReplay = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: { ...originalBody, amount: { value: "123.450" } },
      });
      expect(malformedReplay.status).toBe(422);

      const normalizedReplayResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: { ...originalBody, amount: { value: "123.40", currency: "THB" } },
      });
      const normalizedReplay = transactionResponseSchema.parse(
        await normalizedReplayResponse.json(),
      );
      expect(normalizedReplayResponse.status).toBe(201);
      expect(normalizedReplay).toEqual(first);

      await db
        .update(transactions)
        .set({ amount: 60_000n, note: "Edited" })
        .where(eq(transactions.id, first.id));
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "retry",
          body: { ...originalBody, note: "Changed" },
        }),
        { status: 409, code: "idempotency-conflict" },
      );

      await softDelete(db, first.id);
      const lateResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "retry",
        body: originalBody,
      });
      const late = transactionResponseSchema.parse(await lateResponse.json());
      expect(lateResponse.status).toBe(201);
      expect(late).toEqual(first);
    });
  });

  test("does not consume a key after application validation and maps field failures", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "create-validation" });
      const base = expenseBody(owner);
      const invalidDate = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "correct-date",
          body: { ...base, transactionDate: "2026-02-30" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(invalidDate.errors).toEqual([
        { pointer: "#/transactionDate", code: "invalid-date" },
      ]);
      expect(
        (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "correct-date",
            body: base,
          })
        ).status,
      ).toBe(201);

      const amount = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "bad-amount",
          body: { ...base, amount: { value: "0.00", currency: "THB" } },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(amount.errors).toEqual([
        { pointer: "#/amount/value", code: "amount-out-of-range" },
      ]);
      const note = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "bad-note",
          body: { ...base, note: "x".repeat(201) },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(note.errors).toEqual([
        { pointer: "#/note", code: "note-too-long" },
      ]);
      const future = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "future",
          body: { ...base, transactionDate: "2999-01-01" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(future.errors).toEqual([
        { pointer: "#/transactionDate", code: "future-date" },
      ]);
      const beforeOpening = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "before-opening",
          body: { ...base, transactionDate: "2026-08-31" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(beforeOpening.errors).toEqual([
        { pointer: "#/transactionDate", code: "before-opening" },
      ]);
    });
  });

  test("rejects foreign, archived, and wrong-tree resources", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "create-resources" });
      const foreign = await createOwner(app, {
        db,
        label: "create-resources-foreign",
      });
      const wallet = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "foreign-wallet",
          body: { ...expenseBody(owner), walletId: foreign.cashId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(wallet.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-not-found" },
      ]);
      const category = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "foreign-category",
          body: { ...expenseBody(owner), categoryId: foreign.childId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(category.errors).toEqual([
        { pointer: "#/categoryId", code: "category-not-found" },
      ]);
      const mismatch = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "wrong-tree",
          body: { ...expenseBody(owner), categoryId: owner.incomeId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(mismatch.errors).toEqual([
        { pointer: "#/categoryId", code: "category-kind-mismatch" },
      ]);

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.cashId));
      const archived = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "archived-wallet",
          body: expenseBody(owner),
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(archived.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-archived" },
      ]);
    });
  });

  test("requires authentication, a usable idempotency key, and valid JSON", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "create-boundary" });
      for (const idempotencyKey of [undefined, "   ", "x".repeat(256)]) {
        await expectProblem(
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey,
            body: expenseBody(owner),
          }),
          { status: 400, code: "idempotency-key-required" },
        );
      }
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "malformed-json",
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
      await expectProblem(
        await postTransaction(createIntegrationTestApp(db), {
          idempotencyKey: "anonymous",
          body: expenseBody(owner),
        }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });

  test("creates a full refund with its expense link and inherited category", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "refund-create" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const response = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "refund-create",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "123.45", currency: "THB" },
        },
      });
      const refund = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      expect(response.headers.get("location")).toBe(
        `/v1/transactions/${refund.id}`,
      );
      expect(refund).toEqual({
        id: refund.id,
        type: "refund",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-03",
        note: "Returned",
        recordedAt: expect.any(String),
        wallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: {
          id: expense.id,
          amount: { value: "123.45", currency: "THB" },
          transactionDate: "2026-09-02",
        },
      });

      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9876.55", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "123.45", currency: "THB" },
          }),
        ]),
      );
      const refunds = transactionRefundsResponseSchema.parse(
        await (
          await getTransactionRefunds(app, {
            id: expense.id,
            cookie: owner.cookie,
          })
        ).json(),
      );
      expect(refunds.refunds).toEqual([
        expect.objectContaining({
          id: refund.id,
          amount: { value: "123.45", currency: "THB" },
        }),
      ]);
      expect(refunds.refundedTotal).toEqual({
        value: "123.45",
        currency: "THB",
      });
      expect(refunds.remaining).toEqual({ value: "0.00", currency: "THB" });
    });
  });

  test("refunds part of an expense to an alternate wallet and tracks what remains", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "refund-partial" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "partial-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "100.00", currency: "THB" },
            },
          })
        ).json(),
      );
      const toBankResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "partial-refund-bank",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "30.00", currency: "THB" },
        },
      });
      const toBank = transactionResponseSchema.parse(
        await toBankResponse.json(),
      );
      const toCashResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "partial-refund-cash",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "25.50", currency: "THB" },
          walletId: owner.cashId,
          transactionDate: "2026-09-04",
        },
      });
      const toCash = transactionResponseSchema.parse(
        await toCashResponse.json(),
      );

      expect(toBankResponse.status).toBe(201);
      expect(toCashResponse.status).toBe(201);
      expect(toBank.wallet.id).toBe(owner.bankId);
      expect(toCash.wallet.id).toBe(owner.cashId);
      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9925.50", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "30.00", currency: "THB" },
          }),
        ]),
      );
      const refunds = transactionRefundsResponseSchema.parse(
        await (
          await getTransactionRefunds(app, {
            id: expense.id,
            cookie: owner.cookie,
          })
        ).json(),
      );
      expect(refunds.refundedTotal).toEqual({
        value: "55.50",
        currency: "THB",
      });
      expect(refunds.remaining).toEqual({ value: "44.50", currency: "THB" });
    });
  });

  test("rejects invalid refund shapes and maps refund failures", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "refund-validation" });
      const foreign = await createOwner(app, {
        db,
        label: "refund-validation-foreign",
      });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-validation-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "20.00", currency: "THB" },
            },
          })
        ).json(),
      );
      const foreignExpense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: foreign.cookie,
            idempotencyKey: "refund-validation-foreign-expense",
            body: expenseBody(foreign),
          })
        ).json(),
      );
      const body = refundBody(owner, expense.id);

      const zeroAmount = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-zero-amount",
          body: { ...body, amount: { value: "0.00", currency: "THB" } },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(zeroAmount.errors).toEqual([
        { pointer: "#/amount/value", code: "amount-out-of-range" },
      ]);

      const missingLink = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-missing-link",
          body: { ...body, refundOfTransactionId: undefined },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(missingLink.errors).toEqual([
        { pointer: "#/refundOfTransactionId", code: "invalid-type" },
      ]);
      const category = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-category",
          body: { ...body, categoryId: owner.childId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(category.errors).toEqual([
        { pointer: "#/", code: "unrecognized-keys" },
      ]);

      const overLimit = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-over-limit",
          body: { ...body, amount: { value: "20.01", currency: "THB" } },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(overLimit.errors).toEqual([
        { pointer: "#/amount/value", code: "exceeds-refundable" },
      ]);
      const beforeExpense = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-before-expense",
          body: { ...body, transactionDate: "2026-09-01" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(beforeExpense.errors).toEqual([
        { pointer: "#/transactionDate", code: "before-expense" },
      ]);

      await db
        .update(wallets)
        .set({ openingDate: "2026-09-04" })
        .where(eq(wallets.id, owner.bankId));
      const beforeOpening = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-before-opening",
          body,
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(beforeOpening.errors).toEqual([
        { pointer: "#/transactionDate", code: "before-opening" },
      ]);
      await db
        .update(wallets)
        .set({ openingDate: "2026-09-01" })
        .where(eq(wallets.id, owner.bankId));

      const foreignExpenseLink = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-foreign-expense",
          body: { ...body, refundOfTransactionId: foreignExpense.id },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(foreignExpenseLink.errors).toEqual([
        { pointer: "#/refundOfTransactionId", code: "expense-not-found" },
      ]);
      const deletedExpense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-validation-deleted-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "5.00", currency: "THB" },
            },
          })
        ).json(),
      );
      await softDelete(db, deletedExpense.id);
      const deletedExpenseLink = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-deleted-expense",
          body: { ...body, refundOfTransactionId: deletedExpense.id },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(deletedExpenseLink.errors).toEqual([
        { pointer: "#/refundOfTransactionId", code: "expense-not-found" },
      ]);
      const income = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-validation-income",
            body: {
              ...expenseBody(owner),
              type: "income",
              amount: { value: "10.00", currency: "THB" },
              walletId: owner.bankId,
              categoryId: owner.incomeId,
              note: "Salary",
            },
          })
        ).json(),
      );
      const incomeLink = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-income-link",
          body: { ...body, refundOfTransactionId: income.id },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(incomeLink.errors).toEqual([
        { pointer: "#/refundOfTransactionId", code: "expense-not-found" },
      ]);
      const foreignWallet = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-foreign-wallet",
          body: { ...body, walletId: foreign.bankId },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(foreignWallet.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-not-found" },
      ]);

      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(eq(wallets.id, owner.bankId));
      const archivedWallet = await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-archived-wallet",
          body,
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(archivedWallet.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-archived" },
      ]);
      await db
        .update(wallets)
        .set({ archivedAt: null })
        .where(eq(wallets.id, owner.bankId));

      expect(
        (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-over-limit",
            body,
          })
        ).status,
      ).toBe(201);
    });
  });

  test("replays a refund and conflicts when its payload changes", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "refund-retry" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "refund-retry-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const body = {
        ...refundBody(owner, expense.id),
        amount: { value: "20.0", currency: "THB" },
      };
      const firstResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "refund-retry",
        body,
      });
      const first = transactionResponseSchema.parse(await firstResponse.json());

      const replayResponse = await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "refund-retry",
        body: { ...body, amount: { value: "20.00", currency: "THB" } },
      });
      const replay = transactionResponseSchema.parse(
        await replayResponse.json(),
      );

      expect(firstResponse.status).toBe(201);
      expect(replayResponse.status).toBe(201);
      expect(replay).toEqual(first);
      await expectProblem(
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-retry",
          body: { ...body, amount: { value: "21.00", currency: "THB" } },
        }),
        { status: 409, code: "idempotency-conflict" },
      );

      const transactionsResponse = await listTransactions(app, {
        cookie: owner.cookie,
      });
      const transactionCollection = transactionCollectionResponseSchema.parse(
        await transactionsResponse.json(),
      );
      expect(
        transactionCollection.items.filter(
          (transaction) => transaction.type === "refund",
        ),
      ).toHaveLength(1);
      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "20.00", currency: "THB" },
          }),
        ]),
      );
    });
  });

  test("concurrent refund requests cannot exceed the expense", async () => {
    const db = committed();
    const app = createIntegrationTestApp(db);
    const owner = await createOwner(app, { db, label: "refund-concurrent" });
    const expense = transactionResponseSchema.parse(
      await (
        await postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "refund-concurrent-expense",
          body: {
            ...expenseBody(owner),
            amount: { value: "20.00", currency: "THB" },
          },
        })
      ).json(),
    );

    const responses = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: `refund-race-${index}`,
          body: refundBody(owner, expense.id),
        }),
      ),
    );
    const created = responses.filter((response) => response.status === 201);
    expect(created).toHaveLength(1);
    for (const rejected of responses.filter(
      (response) => response.status !== 201,
    )) {
      await expectProblem(rejected, {
        status: 422,
        code: "invalid-command",
      });
    }

    const walletResponse = await listWallets(app, owner.cookie);
    const walletCollection = walletCollectionResponseSchema.parse(
      await walletResponse.json(),
    );
    expect(walletCollection.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: owner.bankId,
          balance: { value: "20.00", currency: "THB" },
        }),
      ]),
    );
  });

  test("concurrent requests with one key create one transaction and replay it", async () => {
    const db = committed();
    const app = createIntegrationTestApp(db);
    const owner = await createOwner(app, { db, label: "create-concurrent" });
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "concurrent",
          body: expenseBody(owner),
        }),
      ),
    );
    const bodies = await Promise.all(
      responses.map(async (response) =>
        transactionResponseSchema.parse(await response.json()),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
  });

  test("concurrent transfer requests move money exactly once", async () => {
    const db = committed();
    const app = createIntegrationTestApp(db);
    const owner = await createOwner(app, { db, label: "transfer-concurrent" });
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        postTransaction(app, {
          cookie: owner.cookie,
          idempotencyKey: "transfer-concurrent",
          body: transferBody(owner),
        }),
      ),
    );
    const bodies = await Promise.all(
      responses.map(async (response) =>
        transactionResponseSchema.parse(await response.json()),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);

    const walletResponse = await listWallets(app, owner.cookie);
    const walletCollection = walletCollectionResponseSchema.parse(
      await walletResponse.json(),
    );
    expect(walletCollection.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: owner.cashId,
          balance: { value: "9876.55", currency: "THB" },
        }),
        expect.objectContaining({
          id: owner.bankId,
          balance: { value: "123.45", currency: "THB" },
        }),
      ]),
    );
  });
});

describe("PUT /v1/transactions/{transactionId}", () => {
  test("corrects an expense with exact money, wallet, category, and date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-expense" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const response = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "50.00", currency: "THB" },
          walletId: owner.bankId,
          categoryId: owner.childId,
          transactionDate: "2026-09-03",
          note: "Corrected",
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated).toEqual({
        id: expense.id,
        type: "expense",
        amount: { value: "50.00", currency: "THB" },
        transactionDate: "2026-09-03",
        note: "Corrected",
        recordedAt: expense.recordedAt,
        wallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: null,
      });

      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "10000.00", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "-50.00", currency: "THB" },
          }),
        ]),
      );
    });
  });

  test("succeeds without effect when the update changes nothing", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-noop" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-noop",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const body = updateExpenseBody(owner);

      const first = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body,
      });
      const replay = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body,
      });
      const replayed = transactionResponseSchema.parse(await replay.json());

      expect(first.status).toBe(200);
      expect(replay.status).toBe(200);
      expect(replayed).toEqual(
        transactionResponseSchema.parse(await first.json()),
      );
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([]);
    });
  });

  test("corrects a transfer's wallets and amount", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-transfer" });
      const transfer = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-transfer",
            body: transferBody(owner),
          })
        ).json(),
      );
      const response = await putTransaction(app, {
        id: transfer.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "45.00", currency: "THB" },
          walletId: owner.bankId,
          destinationWalletId: owner.cashId,
          transactionDate: "2026-09-03",
          note: "Move money",
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated).toEqual({
        id: transfer.id,
        type: "transfer",
        amount: { value: "45.00", currency: "THB" },
        transactionDate: "2026-09-03",
        note: "Move money",
        recordedAt: transfer.recordedAt,
        wallet: {
          id: owner.bankId,
          name: "Bank",
          type: "bank_account",
          archived: false,
        },
        destinationWallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        category: null,
        refundOf: null,
      });

      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "10045.00", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "-45.00", currency: "THB" },
          }),
        ]),
      );
    });
  });

  test("corrects a refund inside its expense, keeping the link and inherited category", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-refund" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refund-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "500.00", currency: "THB" },
            },
          })
        ).json(),
      );
      const first = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refund-first",
            body: {
              ...refundBody(owner, expense.id),
              amount: { value: "300.00", currency: "THB" },
            },
          })
        ).json(),
      );
      const second = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refund-second",
            body: {
              ...refundBody(owner, expense.id),
              amount: { value: "100.00", currency: "THB" },
              transactionDate: "2026-09-05",
            },
          })
        ).json(),
      );

      // The other refund holds ฿100.00, so the edited one may take ฿400.00.
      const overLimit = await expectProblem(
        await putTransaction(app, {
          id: first.id,
          cookie: owner.cookie,
          body: {
            amount: { value: "400.01", currency: "THB" },
            walletId: owner.bankId,
            transactionDate: "2026-09-03",
            note: "Returned",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(overLimit.errors).toEqual([
        { pointer: "#/amount/value", code: "exceeds-refundable" },
      ]);
      const beforeExpense = await expectProblem(
        await putTransaction(app, {
          id: first.id,
          cookie: owner.cookie,
          body: {
            amount: { value: "300.00", currency: "THB" },
            walletId: owner.bankId,
            transactionDate: "2026-09-01",
            note: "Returned",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(beforeExpense.errors).toEqual([
        { pointer: "#/transactionDate", code: "before-expense" },
      ]);
      const withCategory = await expectProblem(
        await putTransaction(app, {
          id: first.id,
          cookie: owner.cookie,
          body: {
            amount: { value: "300.00", currency: "THB" },
            walletId: owner.bankId,
            categoryId: owner.childId,
            transactionDate: "2026-09-03",
            note: "Returned",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(withCategory.errors).toEqual([
        { pointer: "#/", code: "invalid-refund" },
      ]);

      const response = await putTransaction(app, {
        id: first.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "400.00", currency: "THB" },
          walletId: owner.cashId,
          transactionDate: "2026-09-04",
          note: "Returned",
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated).toEqual({
        id: first.id,
        type: "refund",
        amount: { value: "400.00", currency: "THB" },
        transactionDate: "2026-09-04",
        note: "Returned",
        recordedAt: first.recordedAt,
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: {
          id: expense.id,
          amount: { value: "500.00", currency: "THB" },
          transactionDate: "2026-09-02",
        },
      });

      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9900.00", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "100.00", currency: "THB" },
          }),
        ]),
      );
      const refunds = transactionRefundsResponseSchema.parse(
        await (
          await getTransactionRefunds(app, {
            id: expense.id,
            cookie: owner.cookie,
          })
        ).json(),
      );
      expect(refunds.refunds).toEqual([
        expect.objectContaining({
          id: first.id,
          amount: { value: "400.00", currency: "THB" },
          wallet: expect.objectContaining({ id: owner.cashId }),
        }),
        expect.objectContaining({
          id: second.id,
          amount: { value: "100.00", currency: "THB" },
        }),
      ]);
      expect(refunds.refundedTotal).toEqual({
        value: "500.00",
        currency: "THB",
      });
      expect(refunds.remaining).toEqual({ value: "0.00", currency: "THB" });
    });
  });

  test("an expense keeps covering its refunds in amount and date", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-refunded" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-refunded-expense",
            body: {
              ...expenseBody(owner),
              amount: { value: "500.00", currency: "THB" },
            },
          })
        ).json(),
      );
      await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "update-refunded-early",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "100.00", currency: "THB" },
        },
      });
      await postTransaction(app, {
        cookie: owner.cookie,
        idempotencyKey: "update-refunded-late",
        body: {
          ...refundBody(owner, expense.id),
          amount: { value: "50.00", currency: "THB" },
          transactionDate: "2026-09-05",
        },
      });

      const belowRefunded = await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: {
            ...updateExpenseBody(owner),
            amount: { value: "149.99", currency: "THB" },
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(belowRefunded.errors).toEqual([
        { pointer: "#/amount/value", code: "below-refunded" },
      ]);
      const afterRefund = await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: {
            ...updateExpenseBody(owner),
            amount: { value: "500.00", currency: "THB" },
            transactionDate: "2026-09-04",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(afterRefund.errors).toEqual([
        { pointer: "#/transactionDate", code: "after-refund" },
      ]);

      const response = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body: {
          ...updateExpenseBody(owner),
          amount: { value: "150.00", currency: "THB" },
        },
      });
      const updated = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(updated.amount).toEqual({ value: "150.00", currency: "THB" });
      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "9850.00", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "150.00", currency: "THB" },
          }),
        ]),
      );
      const refunds = transactionRefundsResponseSchema.parse(
        await (
          await getTransactionRefunds(app, {
            id: expense.id,
            cookie: owner.cookie,
          })
        ).json(),
      );
      expect(refunds.refundedTotal).toEqual({
        value: "150.00",
        currency: "THB",
      });
      expect(refunds.remaining).toEqual({ value: "0.00", currency: "THB" });
    });
  });

  test("an edit keeps its archived wallet but cannot move to a different archived one", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-retain" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-retain",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const otherId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Other",
        type: "cash",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(inArray(wallets.id, [owner.cashId, otherId]));

      const retained = await putTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "50.00", currency: "THB" },
          walletId: owner.cashId,
          categoryId: owner.childId,
          transactionDate: "2026-09-02",
          note: "Lunch",
        },
      });
      const retainedBody = transactionResponseSchema.parse(
        await retained.json(),
      );
      expect(retained.status).toBe(200);
      expect(retainedBody.wallet).toEqual({
        id: owner.cashId,
        name: "Cash",
        type: "cash",
        archived: true,
      });

      const moved = await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: {
            amount: { value: "50.00", currency: "THB" },
            walletId: otherId,
            categoryId: owner.childId,
            transactionDate: "2026-09-02",
            note: "Lunch",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(moved.errors).toEqual([
        { pointer: "#/walletId", code: "wallet-archived" },
      ]);
    });
  });

  test("a transfer edit keeps or swaps its archived wallets but rejects a different archived destination", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, {
        db,
        label: "update-retain-transfer",
      });
      const transfer = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-retain-transfer",
            body: transferBody(owner),
          })
        ).json(),
      );
      const otherId = await insertWallet(db, {
        ownerId: owner.ownerId,
        name: "Other",
        type: "cash",
      });
      await db
        .update(wallets)
        .set({ archivedAt: new Date() })
        .where(inArray(wallets.id, [owner.cashId, owner.bankId, otherId]));

      const kept = await putTransaction(app, {
        id: transfer.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "200.00", currency: "THB" },
          walletId: owner.cashId,
          destinationWalletId: owner.bankId,
          transactionDate: "2026-09-02",
          note: "Move money",
        },
      });
      expect(kept.status).toBe(200);

      const swapped = await putTransaction(app, {
        id: transfer.id,
        cookie: owner.cookie,
        body: {
          amount: { value: "300.00", currency: "THB" },
          walletId: owner.bankId,
          destinationWalletId: owner.cashId,
          transactionDate: "2026-09-02",
          note: "Move money",
        },
      });
      const swappedBody = transactionResponseSchema.parse(await swapped.json());
      expect(swapped.status).toBe(200);
      expect(swappedBody.wallet).toEqual(
        expect.objectContaining({ id: owner.bankId }),
      );
      expect(swappedBody.destinationWallet).toEqual(
        expect.objectContaining({ id: owner.cashId }),
      );

      const moved = await expectProblem(
        await putTransaction(app, {
          id: transfer.id,
          cookie: owner.cookie,
          body: {
            amount: { value: "300.00", currency: "THB" },
            walletId: owner.bankId,
            destinationWalletId: otherId,
            transactionDate: "2026-09-02",
            note: "Move money",
          },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(moved.errors).toEqual([
        { pointer: "#/destinationWalletId", code: "wallet-archived" },
      ]);
      const walletResponse = await listWallets(app, owner.cookie);
      const walletCollection = walletCollectionResponseSchema.parse(
        await walletResponse.json(),
      );
      expect(walletCollection.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: owner.cashId,
            balance: { value: "10300.00", currency: "THB" },
          }),
          expect.objectContaining({
            id: owner.bankId,
            balance: { value: "-300.00", currency: "THB" },
          }),
        ]),
      );
    });
  });

  test("maps invalid update input to field errors", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-validation" });
      const foreign = await createOwner(app, {
        db,
        label: "update-validation-foreign",
      });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-validation",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const base = updateExpenseBody(owner);
      const attempt = async (
        body: Readonly<Partial<TransactionUpdateBody>>,
        expected: Readonly<{ pointer: string; code: string }>,
      ) => {
        const problem = await expectProblem(
          await putTransaction(app, {
            id: expense.id,
            cookie: owner.cookie,
            body: { ...base, ...body },
          }),
          { status: 422, code: "invalid-command" },
        );
        expect(problem.errors).toEqual([expected]);
      };

      await attempt(
        { amount: { value: "0.00", currency: "THB" } },
        { pointer: "#/amount/value", code: "amount-out-of-range" },
      );
      await attempt(
        { amount: { value: "100000000.00", currency: "THB" } },
        { pointer: "#/amount/value", code: "amount-out-of-range" },
      );
      await attempt(
        { note: "x".repeat(201) },
        { pointer: "#/note", code: "note-too-long" },
      );
      await attempt(
        { transactionDate: "2026-02-30" },
        { pointer: "#/transactionDate", code: "invalid-date" },
      );
      await attempt(
        { transactionDate: "2026-08-31" },
        { pointer: "#/transactionDate", code: "before-opening" },
      );
      await attempt(
        { transactionDate: "2999-01-01" },
        { pointer: "#/transactionDate", code: "future-date" },
      );
      await attempt(
        { walletId: foreign.cashId },
        { pointer: "#/walletId", code: "wallet-not-found" },
      );
      await attempt(
        { categoryId: foreign.childId },
        { pointer: "#/categoryId", code: "category-not-found" },
      );
      await attempt(
        { categoryId: owner.incomeId },
        { pointer: "#/categoryId", code: "category-kind-mismatch" },
      );
      await attempt(
        { destinationWalletId: owner.bankId },
        { pointer: "#/", code: "invalid-transfer" },
      );
      const unrecognized = await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: { ...base, note: "Edited", extra: true },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(unrecognized.errors).toEqual([
        { pointer: "#/", code: "unrecognized-keys" },
      ]);
    });
  });

  test("unknown, cross-owner, malformed, and deleted identifiers are not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-hidden" });
      const foreign = await createOwner(app, {
        db,
        label: "update-hidden-foreign",
      });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-hidden",
            body: expenseBody(owner),
          })
        ).json(),
      );

      for (const requestedId of [
        UNKNOWN_TRANSACTION_ID,
        // Another owner's transaction reads as missing, not forbidden.
        expense.id,
        "not-a-uuid",
      ]) {
        await expectProblem(
          await putTransaction(app, {
            id: requestedId,
            cookie: foreign.cookie,
            body: updateExpenseBody(foreign),
          }),
          { status: 404, code: "not-found" },
        );
      }
      await softDelete(db, expense.id);
      await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          body: updateExpenseBody(owner),
        }),
        { status: 404, code: "not-found" },
      );
    });
  });

  test("requires authentication and valid JSON", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "update-boundary" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "update-boundary",
            body: expenseBody(owner),
          })
        ).json(),
      );
      await expectProblem(
        await putTransaction(createIntegrationTestApp(db), {
          id: expense.id,
          body: updateExpenseBody(owner),
        }),
        { status: 401, code: "unauthenticated" },
      );
      await expectProblem(
        await putTransaction(app, {
          id: expense.id,
          cookie: owner.cookie,
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});

describe("DELETE /v1/transactions/{transactionId}", () => {
  test("deletes an eligible transaction with no response body and repeats without a second history entry", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "delete-eligible" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-eligible",
            body: expenseBody(owner),
          })
        ).json(),
      );

      const response = await deleteTransaction(app, {
        id: expense.id,
        cookie: owner.cookie,
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");
      await expectProblem(
        await getTransaction(app, { id: expense.id, cookie: owner.cookie }),
        {
          status: 404,
          code: "not-found",
        },
      );
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toEqual([
        expect.objectContaining({
          action: "delete",
          before: expect.objectContaining({ amount: "12345" }),
          after: null,
        }),
      ]);

      const wallet = walletCollectionResponseSchema
        .parse(await (await listWallets(app, owner.cookie)).json())
        .items.find((entry) => entry.id === owner.cashId);
      expect(wallet?.balance).toEqual({ value: "10000.00", currency: "THB" });

      // Repeating the deletion is the same outcome, not a second entry.
      expect(
        (await deleteTransaction(app, { id: expense.id, cookie: owner.cookie }))
          .status,
      ).toBe(204);
      expect(
        await listTransactionChanges(db, {
          ownerId: owner.ownerId,
          id: expense.id,
        }),
      ).toHaveLength(1);
    });
  });

  test("an expense with linked refunds stays and answers one stable conflict problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "delete-blocked" });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-blocked-expense",
            body: expenseBody(owner),
          })
        ).json(),
      );
      const refund = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-blocked-refund",
            body: refundBody(owner, expense.id),
          })
        ).json(),
      );

      await expectProblem(
        await deleteTransaction(app, { id: expense.id, cookie: owner.cookie }),
        { status: 409, code: "conflict" },
      );
      // The blocked expense keeps its detail, its refunds, and its effects.
      expect(
        (await getTransaction(app, { id: expense.id, cookie: owner.cookie }))
          .status,
      ).toBe(200);

      // Deleting the refund frees the expense.
      expect(
        (await deleteTransaction(app, { id: refund.id, cookie: owner.cookie }))
          .status,
      ).toBe(204);
      expect(
        (await deleteTransaction(app, { id: expense.id, cookie: owner.cookie }))
          .status,
      ).toBe(204);
      const wallets = walletCollectionResponseSchema.parse(
        await (await listWallets(app, owner.cookie)).json(),
      );
      expect(
        wallets.items.map((wallet) => [wallet.name, wallet.balance.value]),
      ).toEqual([
        ["Cash", "10000.00"],
        ["Bank", "0.00"],
      ]);
    });
  });

  test("does not disclose missing, another owner's, or malformed identifiers", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "delete-hidden" });
      const foreign = await createOwner(app, {
        db,
        label: "delete-hidden-foreign",
      });
      const expense = transactionResponseSchema.parse(
        await (
          await postTransaction(app, {
            cookie: owner.cookie,
            idempotencyKey: "delete-hidden",
            body: expenseBody(owner),
          })
        ).json(),
      );

      for (const attempt of [
        { id: UNKNOWN_TRANSACTION_ID, cookie: foreign.cookie },
        // Another owner's transaction reads as missing, not forbidden.
        { id: expense.id, cookie: foreign.cookie },
        { id: "not-a-uuid", cookie: foreign.cookie },
      ]) {
        await expectProblem(await deleteTransaction(app, attempt), {
          status: 404,
          code: "not-found",
        });
      }
      expect(
        (await getTransaction(app, { id: expense.id, cookie: owner.cookie }))
          .status,
      ).toBe(200);
    });
  });

  test("requires authentication", async () => {
    await withRollback(async (db) => {
      await expectProblem(
        await deleteTransaction(createIntegrationTestApp(db), {
          id: UNKNOWN_TRANSACTION_ID,
        }),
        { status: 401, code: "unauthenticated" },
      );
    });
  });
});

describe("GET /v1/transactions", () => {
  test("pages ties in deterministic order and ignores inserts before the cursor", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "list-page" });
      const recordedAt = new Date("2026-09-05T03:07:08.123Z");
      const oldestId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });
      const middleId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });
      const newestId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-05",
        recordedAt,
      });

      const firstResponse = await listTransactions(app, {
        cookie: owner.cookie,
        query: "limit=2",
      });
      const first = transactionCollectionResponseSchema.parse(
        await firstResponse.json(),
      );
      expect(firstResponse.status).toBe(200);
      expect(first.items.map((transaction) => transaction.id)).toEqual([
        newestId,
        middleId,
      ]);
      expect(first.page.nextCursor).toEqual(expect.any(String));

      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-06",
      });
      const secondResponse = await listTransactions(app, {
        cookie: owner.cookie,
        query: `limit=2&cursor=${encodeURIComponent(first.page.nextCursor ?? "")}`,
      });
      const second = transactionCollectionResponseSchema.parse(
        await secondResponse.json(),
      );
      expect(second.items.map((transaction) => transaction.id)).toEqual([
        oldestId,
      ]);
      expect(second.page.nextCursor).toBeNull();
    });
  });

  test("applies date, wallet, category, and type filters without leaking owners", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "list-filters" });
      const foreign = await createOwner(app, {
        db,
        label: "list-filters-foreign",
      });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        transactionDate: "2026-09-02",
      });
      const directExpenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.parentId,
        transactionDate: "2026-09-03",
      });
      const transferId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        transactionDate: "2026-09-04",
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        transactionDate: "2026-09-05",
      });
      const incomeId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.bankId,
        categoryId: owner.incomeId,
        transactionDate: "2026-09-06",
      });
      await insertTransaction(db, {
        ownerId: foreign.ownerId,
        type: "expense",
        walletId: foreign.cashId,
        categoryId: foreign.childId,
      });

      async function ids(query: string) {
        const response = await listTransactions(app, {
          cookie: owner.cookie,
          query,
        });
        expect(response.status).toBe(200);
        return transactionCollectionResponseSchema
          .parse(await response.json())
          .items.map((transaction) => transaction.id);
      }

      expect(await ids("from=2026-09-03&to=2026-09-04")).toEqual([
        transferId,
        directExpenseId,
      ]);
      expect(await ids(`walletId=${owner.bankId}`)).toEqual([
        incomeId,
        refundId,
        transferId,
      ]);
      expect(await ids(`categoryId=${owner.parentId}`)).toEqual([
        refundId,
        directExpenseId,
        expenseId,
      ]);
      expect(await ids("type=transfer")).toEqual([transferId]);
      expect(await ids("type=refund")).toEqual([refundId]);
      expect(await ids("type=income")).toEqual([incomeId]);
      expect(await ids("type=expense")).toEqual([directExpenseId, expenseId]);
      expect(await ids(`walletId=${foreign.cashId}`)).toEqual([]);
    });
  });

  test("rejects invalid or mismatched cursors, caps limits, and returns empty pages explicitly", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "list-validation" });
      for (let index = 0; index < 101; index += 1) {
        await insertTransaction(db, {
          ownerId: owner.ownerId,
          type: "expense",
          walletId: owner.cashId,
          categoryId: owner.childId,
          transactionDate: "2026-09-02",
          recordedAt: new Date(
            new Date("2026-09-05T03:07:00.000Z").getTime() + index * 1_000,
          ),
        });
      }

      const cappedResponse = await listTransactions(app, {
        cookie: owner.cookie,
        query: "limit=999",
      });
      const capped = transactionCollectionResponseSchema.parse(
        await cappedResponse.json(),
      );
      expect(capped.items).toHaveLength(100);
      expect(capped.page.nextCursor).toEqual(expect.any(String));

      const mismatchResponse = await listTransactions(app, {
        cookie: owner.cookie,
        query: `type=income&cursor=${encodeURIComponent(capped.page.nextCursor ?? "")}`,
      });
      await expectProblem(mismatchResponse, {
        status: 400,
        code: "bad-request",
      });
      await expectProblem(
        await listTransactions(app, {
          cookie: owner.cookie,
          query: "cursor=not-a-cursor",
        }),
        { status: 400, code: "bad-request" },
      );
      const empty = transactionCollectionResponseSchema.parse(
        await (
          await listTransactions(app, {
            cookie: owner.cookie,
            query: "from=2030-01-01",
          })
        ).json(),
      );
      expect(empty).toEqual({ items: [], page: { nextCursor: null } });
    });
  });

  test("requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      await expectProblem(await listTransactions(app), {
        status: 401,
        code: "unauthenticated",
      });
    });
  });
});

describe("GET /v1/transactions/{transactionId}", () => {
  test("presents an expense with exact money, calendar date, recording instant, wallet, and category tree", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "detail" });
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 12_345n,
        transactionDate: "2026-09-02",
        note: "Lunch",
        recordedAt: new Date("2026-09-05T03:07:08.000Z"),
      });

      const response = await getTransaction(app, { id, cookie: owner.cookie });
      const body = transactionResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(body).toEqual({
        id,
        type: "expense",
        amount: { value: "123.45", currency: "THB" },
        transactionDate: "2026-09-02",
        note: "Lunch",
        recordedAt: "2026-09-05T03:07:08.000Z",
        wallet: {
          id: owner.cashId,
          name: "Cash",
          type: "cash",
          archived: false,
        },
        destinationWallet: null,
        category: {
          id: owner.childId,
          name: "Groceries",
          iconId: expect.any(String),
          parentName: "Food & Drink",
        },
        refundOf: null,
      });
    });
  });

  test("presents a transfer with its destination wallet and a refund with its expense link", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "links" });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 2_000n,
        transactionDate: "2026-09-02",
      });
      const transferId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
        amount: 1_000n,
        transactionDate: "2026-09-03",
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 500n,
        transactionDate: "2026-09-04",
      });

      const transfer = transactionResponseSchema.parse(
        await (
          await getTransaction(app, { id: transferId, cookie: owner.cookie })
        ).json(),
      );
      expect(transfer.amount).toEqual({ value: "10.00", currency: "THB" });
      expect(transfer.destinationWallet).toEqual({
        id: owner.bankId,
        name: "Bank",
        type: "bank_account",
        archived: false,
      });
      expect(transfer.category).toBeNull();

      const refund = transactionResponseSchema.parse(
        await (
          await getTransaction(app, { id: refundId, cookie: owner.cookie })
        ).json(),
      );
      expect(refund.refundOf).toEqual({
        id: expenseId,
        amount: { value: "20.00", currency: "THB" },
        transactionDate: "2026-09-02",
      });
      expect(refund.category).toEqual({
        id: owner.childId,
        name: "Groceries",
        iconId: expect.any(String),
        parentName: "Food & Drink",
      });
    });
  });

  test("unknown, cross-owner, malformed, and deleted identifiers are not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "hidden" });
      const foreign = await createOwner(app, { db, label: "hidden-foreign" });
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });

      for (const requestedId of [
        UNKNOWN_TRANSACTION_ID,
        // Another owner's transaction reads as missing, not forbidden.
        id,
        "not-a-uuid",
      ]) {
        await expectProblem(
          await getTransaction(app, {
            id: requestedId,
            cookie: foreign.cookie,
          }),
          { status: 404, code: "not-found" },
        );
      }
      await softDelete(db, id);
      await expectProblem(
        await getTransaction(app, { id, cookie: owner.cookie }),
        { status: 404, code: "not-found" },
      );
    });
  });
});

describe("GET /v1/transactions/{transactionId}/refunds", () => {
  test("totals an expense's refunds with the refundable remainder, oldest date first", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "refunds" });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
        transactionDate: "2026-09-02",
      });
      const laterId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
        amount: 500n,
        transactionDate: "2026-09-04",
      });
      const earlierId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.cashId,
        refundOfTransactionId: expenseId,
        amount: 2_000n,
        transactionDate: "2026-09-03",
      });

      const response = await getTransactionRefunds(app, {
        id: expenseId,
        cookie: owner.cookie,
      });
      const body = transactionRefundsResponseSchema.parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(body).toEqual({
        refunds: [
          {
            id: earlierId,
            amount: { value: "20.00", currency: "THB" },
            transactionDate: "2026-09-03",
            wallet: {
              id: owner.cashId,
              name: "Cash",
              type: "cash",
              archived: false,
            },
          },
          {
            id: laterId,
            amount: { value: "5.00", currency: "THB" },
            transactionDate: "2026-09-04",
            wallet: {
              id: owner.bankId,
              name: "Bank",
              type: "bank_account",
              archived: false,
            },
          },
        ],
        refundedTotal: { value: "25.00", currency: "THB" },
        remaining: { value: "25.00", currency: "THB" },
      });
    });
  });

  test("an expense without refunds has an empty list and the full remainder", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "unrefunded" });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        amount: 5_000n,
      });

      const body = transactionRefundsResponseSchema.parse(
        await (
          await getTransactionRefunds(app, {
            id: expenseId,
            cookie: owner.cookie,
          })
        ).json(),
      );
      expect(body).toEqual({
        refunds: [],
        refundedTotal: { value: "0.00", currency: "THB" },
        remaining: { value: "50.00", currency: "THB" },
      });
    });
  });

  test("only a current owned expense has an allowance; everything else is not found alike", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "allowance" });
      const foreign = await createOwner(app, {
        db,
        label: "allowance-foreign",
      });
      const expenseId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });
      const incomeId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "income",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });
      const transferId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "transfer",
        walletId: owner.cashId,
        destinationWalletId: owner.bankId,
      });
      const refundId = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "refund",
        walletId: owner.bankId,
        refundOfTransactionId: expenseId,
      });

      for (const requestedId of [
        UNKNOWN_TRANSACTION_ID,
        incomeId,
        transferId,
        refundId,
        "not-a-uuid",
      ]) {
        await expectProblem(
          await getTransactionRefunds(app, {
            id: requestedId,
            cookie: owner.cookie,
          }),
          { status: 404, code: "not-found" },
        );
      }
      await expectProblem(
        await getTransactionRefunds(app, {
          id: expenseId,
          cookie: foreign.cookie,
        }),
        { status: 404, code: "not-found" },
      );

      await softDelete(db, expenseId);
      await expectProblem(
        await getTransactionRefunds(app, {
          id: expenseId,
          cookie: owner.cookie,
        }),
        { status: 404, code: "not-found" },
      );
    });
  });
});

describe("GET /v1/transactions/entry-defaults", () => {
  test("names the most recently recorded wallet for the entry form", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "defaults" });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
        recordedAt: new Date("2026-09-05T01:00:00.000Z"),
      });
      await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.bankId,
        categoryId: owner.childId,
        recordedAt: new Date("2026-09-05T02:00:00.000Z"),
      });

      const response = await getEntryDefaults(app, owner.cookie);
      const body = transactionEntryDefaultsResponseSchema.parse(
        await response.json(),
      );

      expect(response.status).toBe(200);
      expect(body.lastUsedWalletId).toBe(owner.bankId);
    });
  });

  test("ignores deleted transactions and leaves a fresh owner without a default", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "fresh" });
      const foreign = await createOwner(app, { db, label: "fresh-foreign" });

      expect(
        transactionEntryDefaultsResponseSchema.parse(
          await (await getEntryDefaults(app, owner.cookie)).json(),
        ),
      ).toEqual({ lastUsedWalletId: null });

      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });
      await softDelete(db, id);
      expect(
        transactionEntryDefaultsResponseSchema.parse(
          await (await getEntryDefaults(app, owner.cookie)).json(),
        ),
      ).toEqual({ lastUsedWalletId: null });
      expect(
        transactionEntryDefaultsResponseSchema.parse(
          await (await getEntryDefaults(app, foreign.cookie)).json(),
        ),
      ).toEqual({ lastUsedWalletId: null });
    });
  });
});

describe("unauthenticated transaction reads", () => {
  test("every read requires authentication", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const owner = await createOwner(app, { db, label: "anon" });
      const id = await insertTransaction(db, {
        ownerId: owner.ownerId,
        type: "expense",
        walletId: owner.cashId,
        categoryId: owner.childId,
      });

      const responses = [
        await getTransaction(app, { id }),
        await getTransactionRefunds(app, { id }),
        await getEntryDefaults(app),
      ];
      for (const response of responses) {
        await expectProblem(response, {
          status: 401,
          code: "unauthenticated",
        });
      }
    });
  });
});
