import {
  findExpenseRefunds,
  findLastUsedWalletId,
  findTransaction,
  listTransactionPage,
} from "@bookkeeping/application/transactions";
import type { Database } from "@bookkeeping/database/connection";
import type {
  ExpenseRefunds,
  TransactionDetail,
} from "@bookkeeping/domain/transactions";
import { TRANSACTION_TYPES } from "@bookkeeping/domain/transactions";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import { moneySchema, presentMoney } from "../../core/http/money.js";
import {
  describeProblem,
  describeProblemResponse,
} from "../../core/http/openapi.js";
import type { problemDetailsSchema } from "../../core/http/problem-details.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "../../core/http/problem-details.js";
import {
  createQueryMiddleware,
  createResourceParamMiddleware,
} from "../../core/http/request-validation.js";

import {
  decodeTransactionCursor,
  encodeTransactionCursor,
} from "./transaction-cursor.js";

export const transactionWalletSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(WALLET_TYPES),
    archived: z.boolean(),
  })
  .meta({ id: "TransactionWallet" });

export const transactionResponseSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(TRANSACTION_TYPES),
    amount: moneySchema,
    transactionDate: z.iso.date(),
    note: z.string(),
    recordedAt: z.iso.datetime(),
    wallet: transactionWalletSchema,
    destinationWallet: transactionWalletSchema.nullable(),
    category: z
      .object({
        id: z.uuid(),
        name: z.string(),
        iconId: z.string(),
        parentName: z.string().nullable(),
      })
      .nullable(),
    refundOf: z
      .object({
        id: z.uuid(),
        amount: moneySchema,
        transactionDate: z.iso.date(),
      })
      .nullable(),
  })
  .meta({ id: "Transaction" });

export const transactionCollectionResponseSchema =
  createCollectionResponseSchema(transactionResponseSchema).meta({
    id: "TransactionCollection",
  });

export const transactionRefundsResponseSchema = z
  .object({
    refunds: z.array(
      z.object({
        id: z.uuid(),
        amount: moneySchema,
        transactionDate: z.iso.date(),
        wallet: transactionWalletSchema,
      }),
    ),
    refundedTotal: moneySchema,
    remaining: moneySchema,
  })
  .meta({ id: "TransactionRefunds" });

export const transactionEntryDefaultsResponseSchema = z
  .object({ lastUsedWalletId: z.uuid().nullable() })
  .meta({ id: "TransactionEntryDefaults" });

export type TransactionWalletResponse = z.infer<typeof transactionWalletSchema>;

export type TransactionResponse = z.infer<typeof transactionResponseSchema>;

export type TransactionRefundsResponse = z.infer<
  typeof transactionRefundsResponseSchema
>;

function presentTransactionWallet(
  wallet: Readonly<TransactionDetail["wallet"]>,
): TransactionWalletResponse {
  return {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    archived: wallet.archived,
  };
}

export function presentTransaction(
  transaction: Readonly<TransactionDetail>,
): TransactionResponse {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: presentMoney({
      amountInMinorUnits: transaction.amount,
      currency: transaction.currency,
    }),
    transactionDate: transaction.transactionDate,
    note: transaction.note,
    recordedAt: transaction.recordedAt.toISOString(),
    wallet: presentTransactionWallet(transaction.wallet),
    destinationWallet: transaction.destinationWallet
      ? presentTransactionWallet(transaction.destinationWallet)
      : null,
    category: transaction.category ? { ...transaction.category } : null,
    refundOf: transaction.refundOf
      ? {
          id: transaction.refundOf.id,
          amount: presentMoney({
            amountInMinorUnits: transaction.refundOf.amount,
            currency: transaction.currency,
          }),
          transactionDate: transaction.refundOf.transactionDate,
        }
      : null,
  };
}

export function presentTransactionRefunds(
  refunds: Readonly<ExpenseRefunds>,
): TransactionRefundsResponse {
  // The schema constrains every transaction to THB, so the totals carry it.
  return {
    refunds: refunds.refunds.map((refund) => ({
      id: refund.id,
      amount: presentMoney({
        amountInMinorUnits: refund.amount,
        currency: "THB",
      }),
      transactionDate: refund.transactionDate,
      wallet: presentTransactionWallet(refund.wallet),
    })),
    refundedTotal: presentMoney({
      amountInMinorUnits: refunds.refundedTotal,
      currency: "THB",
    }),
    remaining: presentMoney({
      amountInMinorUnits: refunds.remaining,
      currency: "THB",
    }),
  };
}

// Registered before the resource path so the static entry-defaults read is
// never captured by the identifier route.
const DEFAULT_TRANSACTION_PAGE_LIMIT = 50;
const MAX_TRANSACTION_PAGE_LIMIT = 100;
const COLLECTION_PATH = "/transactions";
const ENTRY_DEFAULTS_PATH = "/transactions/entry-defaults";
const RESOURCE_PATH = "/transactions/:transactionId";
const REFUNDS_PATH = "/transactions/:transactionId/refunds";

const transactionLimitSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed)
      ? Math.min(parsed, MAX_TRANSACTION_PAGE_LIMIT)
      : MAX_TRANSACTION_PAGE_LIMIT;
  });

const transactionListQuerySchema = z
  .strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    walletId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    limit: transactionLimitSchema.optional(),
    cursor: z.string().min(1).optional(),
  })
  .superRefine((query, context) => {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      query.from > query.to
    ) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "The start date must not be after the end date",
      });
    }
  });

const transactionListQueryMiddleware = createQueryMiddleware(
  transactionListQuerySchema,
);

interface TransactionListValidatedInput {
  in: {
    query: z.input<typeof transactionListQuerySchema>;
  };
  out: {
    query: z.output<typeof transactionListQuerySchema>;
  };
}

function toTransactionCursorFilters(
  query: Readonly<z.output<typeof transactionListQuerySchema>>,
) {
  return {
    from: query.from ?? null,
    to: query.to ?? null,
    walletId: query.walletId ?? null,
    categoryId: query.categoryId ?? null,
    type: query.type ?? null,
  };
}

const transactionParamsSchema = z.object({ transactionId: z.uuid() });
const transactionParamMiddleware = createResourceParamMiddleware(
  transactionParamsSchema,
);

export function createTransactionRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .get(
      COLLECTION_PATH,
      describeRoute({
        operationId: "listTransactions",
        summary: "List transactions",
        description:
          "Returns the signed-in owner's current financial history, newest " +
          "transaction date first, then newest recording time and identifier. " +
          "Date, wallet, category, and type filters preserve transfer, parent " +
          "category, refund, and ownership semantics. Pages use an opaque " +
          "cursor bound to this ordering and the active filters; the server " +
          "caps the requested limit.",
        tags: ["Transactions"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      transactionListQueryMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        TransactionListValidatedInput,
        {
          200: typeof transactionCollectionResponseSchema;
          400: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const query = c.req.valid("query");
          const ownerId = c.get("session").user.id;
          const filters = toTransactionCursorFilters(query);
          const after =
            query.cursor === undefined
              ? undefined
              : decodeTransactionCursor(query.cursor, { ownerId, filters });
          if (query.cursor !== undefined && after === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(400));
          }

          const page = await listTransactionPage(db, {
            ownerId,
            from: query.from,
            to: query.to,
            walletId: query.walletId,
            categoryId: query.categoryId,
            type: query.type,
            limit: query.limit ?? DEFAULT_TRANSACTION_PAGE_LIMIT,
            after: after ?? undefined,
          });
          return c.json(
            {
              items: page.items.map(presentTransaction),
              page: {
                nextCursor: page.nextPosition
                  ? encodeTransactionCursor({
                      ownerId,
                      filters,
                      position: page.nextPosition,
                    })
                  : null,
              },
            },
            200,
          );
        },
        {
          200: {
            description: "A page of the owner's current transactions",
            content: {
              "application/json": {
                vSchema: transactionCollectionResponseSchema,
              },
            },
          },
          400: describeProblem(getProblemOptionsForStatus(400)),
        },
      ),
    )
    .get(
      ENTRY_DEFAULTS_PATH,
      describeRoute({
        operationId: "getTransactionEntryDefaults",
        summary: "Get transaction entry defaults",
        description:
          "The server-calculated starting point for the entry form: the " +
          "wallet of the signed-in owner's most recently recorded " +
          "transaction, or null before the first one. Deleted transactions " +
          "never count.",
        tags: ["Transactions"],
        responses: { 401: describeProblemResponse(401) },
      }),
      describeResponse<
        AuthenticatedEnv,
        typeof ENTRY_DEFAULTS_PATH,
        Input,
        { 200: typeof transactionEntryDefaultsResponseSchema }
      >(
        async (c) => {
          const lastUsedWalletId = await findLastUsedWalletId(
            db,
            c.get("session").user.id,
          );
          return c.json({ lastUsedWalletId }, 200);
        },
        {
          200: {
            description: "The entry defaults",
            content: {
              "application/json": {
                vSchema: transactionEntryDefaultsResponseSchema,
              },
            },
          },
        },
      ),
    )
    .get(
      RESOURCE_PATH,
      describeRoute({
        operationId: "getTransaction",
        summary: "Get a transaction",
        description:
          "One current transaction of the signed-in owner with its wallet, " +
          "destination wallet, category, and expense link mapped exactly: " +
          "money as an exact decimal string beside its currency, the " +
          "transaction date as a calendar date, and the recording time as a " +
          "UTC instant. A transaction that does not exist, has been deleted, " +
          "belongs to another owner, or has a malformed identifier is not " +
          "found alike.",
        tags: ["Transactions"],
        responses: { 401: describeProblemResponse(401) },
      }),
      transactionParamMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        Input,
        {
          200: typeof transactionResponseSchema;
          404: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const transaction = await findTransaction(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("transactionId"),
          });
          if (transaction === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(presentTransaction(transaction), 200);
        },
        {
          200: {
            description: "The transaction",
            content: {
              "application/json": { vSchema: transactionResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
        },
      ),
    )
    .get(
      REFUNDS_PATH,
      describeRoute({
        operationId: "getTransactionRefunds",
        summary: "Get an expense's refunds",
        description:
          "The current refunds linked to one of the owner's expenses, " +
          "oldest transaction date first, with what they add up to and what " +
          "is left to refund. Only a current expense has a refund allowance: " +
          "a missing, deleted, foreign, malformed, or non-expense identifier " +
          "is not found alike.",
        tags: ["Transactions"],
        responses: { 401: describeProblemResponse(401) },
      }),
      transactionParamMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof REFUNDS_PATH,
        Input,
        {
          200: typeof transactionRefundsResponseSchema;
          404: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const refunds = await findExpenseRefunds(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("transactionId"),
          });
          if (refunds === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(presentTransactionRefunds(refunds), 200);
        },
        {
          200: {
            description: "The expense's refunds and refundable remainder",
            content: {
              "application/json": {
                vSchema: transactionRefundsResponseSchema,
              },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
        },
      ),
    );
}
