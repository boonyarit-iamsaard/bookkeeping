import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { insertTransaction } from "@bookkeeping/application/testing/transaction-fixture";
import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { transactions } from "@bookkeeping/database/transactions";
import { wallets } from "@bookkeeping/database/wallets";
import type { WalletType } from "@bookkeeping/domain/wallets";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import * as z from "zod";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  signUpThroughAuthRoutes,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  transactionEntryDefaultsResponseSchema,
  transactionRefundsResponseSchema,
  transactionResponseSchema,
} from "./transaction.routes.js";

const { withRollback } = setupTestDatabase();

const TRANSACTIONS_URL = `${TEST_API_ORIGIN}/v1/transactions`;
const UNKNOWN_TRANSACTION_ID = "01999999-0000-7000-8000-000000000000";

const sessionResponseSchema = z.object({ user: z.object({ id: z.string() }) });

/** Signs up through the auth routes and returns the cookie plus the owner's id. */
async function signUp(app: Hono<AppEnv>, label: string) {
  const { cookie } = await signUpThroughAuthRoutes(app, label);
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
  const { cookie, ownerId } = await signUp(app, label);
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
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, ownerId));
  const parent = tree.find((category) => category.name === "Food & Drink");
  const child = tree.find((category) => category.name === "Groceries");
  if (!parent || !child) {
    throw new Error("Missing default expense categories");
  }
  return {
    cookie,
    ownerId,
    cashId,
    bankId,
    parentId: parent.id,
    childId: child.id,
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
