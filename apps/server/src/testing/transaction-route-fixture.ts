import { categories } from "@bookkeeping/database/categories";
import type { Database } from "@bookkeeping/database/connection";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type * as z from "zod";
import type { AppEnv } from "../core/http/request-context.js";
import type { createTransactionRequestSchema } from "../features/transactions/transaction.routes.js";
import { TEST_API_ORIGIN } from "./create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "./create-unit-test-app.js";
import type { OwnerFixture as SharedOwnerFixture } from "./report-fixture.js";
import { createOwner as createSharedOwner } from "./report-fixture.js";

export const TRANSACTIONS_URL = `${TEST_API_ORIGIN}/v1/transactions`;
export const UNKNOWN_TRANSACTION_ID = "01999999-0000-7000-8000-000000000000";

export interface OwnerFixture extends SharedOwnerFixture {
  parentId: string;
  childId: string;
  incomeId: string;
}

/** The shared owner plus the default expense parent, its child, and Salary to file under. */
export async function createOwner({
  db,
}: Readonly<{ db: Database }>): Promise<OwnerFixture> {
  const owner = await createSharedOwner({ db });
  const tree = await db
    .select({ id: categories.id, kind: categories.kind, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, owner.ownerId));
  const parent = tree.find((category) => category.name === "Food & Drink");
  const child = tree.find((category) => category.name === "Groceries");
  const income = tree.find(
    (category) => category.kind === "income" && category.name === "Salary",
  );
  if (!parent || !child || !income) {
    throw new Error("Missing default categories");
  }
  return {
    ...owner,
    parentId: parent.id,
    childId: child.id,
    incomeId: income.id,
  };
}

export interface CreateTransactionRequest {
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
  rawBody?: string;
}

export function postTransaction(
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

export type TransactionCreationBody = z.input<
  typeof createTransactionRequestSchema
>;

export function expenseBody(
  owner: Readonly<OwnerFixture>,
): TransactionCreationBody {
  return {
    type: "expense",
    amount: { value: "123.45", currency: "THB" },
    walletId: owner.cashId,
    categoryId: owner.childId,
    transactionDate: "2026-09-02",
    note: "Lunch",
  };
}

export function refundBody(
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
