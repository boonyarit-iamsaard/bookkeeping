import type {
  TransactionField,
  TransactionRejection,
} from "@bookkeeping/application/transactions";
import {
  createTransaction,
  deleteTransaction,
  findExpenseRefunds,
  findLastUsedWalletId,
  findTransaction,
  listTransactionPage,
  updateTransaction,
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
import type { idempotencyKeyHeaderSchema } from "../../core/http/idempotency.js";
import {
  idempotencyConflictProblem,
  idempotencyKeyMiddleware,
} from "../../core/http/idempotency.js";
import {
  moneyInputSchema,
  moneySchema,
  presentMoney,
} from "../../core/http/money.js";
import {
  describeProblem,
  describeProblemResponse,
} from "../../core/http/openapi.js";
import type {
  ProblemFieldError,
  problemDetailsSchema,
} from "../../core/http/problem-details.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "../../core/http/problem-details.js";

import type {
  QueryValidatedInput,
  ResourceCommandValidatedInput,
} from "../../core/http/request-validation.js";
import {
  createCommandMiddleware,
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

const calendarDateInputSchema = z
  .string()
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: "Use a calendar date in YYYY-MM-DD form",
    params: { code: "invalid-date" },
  });

const createIncomeExpenseTransactionRequestSchema = z.strictObject({
  type: z.enum(["income", "expense"]),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  categoryId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
});

const createTransferTransactionRequestSchema = z.strictObject({
  type: z.literal("transfer"),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  destinationWalletId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
});

const createRefundTransactionRequestSchema = z.strictObject({
  type: z.literal("refund"),
  amount: moneyInputSchema,
  walletId: z.uuid(),
  refundOfTransactionId: z.uuid(),
  transactionDate: calendarDateInputSchema,
  note: z.string(),
});

export const createTransactionRequestSchema = z
  .discriminatedUnion("type", [
    createIncomeExpenseTransactionRequestSchema,
    createTransferTransactionRequestSchema,
    createRefundTransactionRequestSchema,
  ])
  .meta({ id: "CreateTransactionRequest" });

export const updateTransactionRequestSchema = z
  .strictObject({
    amount: moneyInputSchema,
    walletId: z.uuid(),
    categoryId: z.uuid().optional(),
    destinationWalletId: z.uuid().optional(),
    transactionDate: calendarDateInputSchema,
    note: z.string(),
  })
  .meta({ id: "UpdateTransactionRequest" });

interface CreateTransactionValidatedInput {
  in: {
    json: z.input<typeof createTransactionRequestSchema>;
    header: z.input<typeof idempotencyKeyHeaderSchema>;
  };
  out: {
    json: z.output<typeof createTransactionRequestSchema>;
    header: z.output<typeof idempotencyKeyHeaderSchema>;
  };
}

/** Where each rejected input lives in a create request document. */
const CREATE_FIELD_POINTERS: Record<TransactionField, string> = {
  type: "#/type",
  walletId: "#/walletId",
  destinationWalletId: "#/destinationWalletId",
  categoryId: "#/categoryId",
  refundOfTransactionId: "#/refundOfTransactionId",
  amount: "#/amount/value",
  transactionDate: "#/transactionDate",
  note: "#/note",
};

// The update request names no type or refund link: a contradiction with the
// fixed type addresses the whole document.
const UPDATE_FIELD_POINTERS: Record<TransactionField, string> = {
  ...CREATE_FIELD_POINTERS,
  type: "#/",
  refundOfTransactionId: "#/",
};

function toFieldErrors(
  rejection: Readonly<TransactionRejection>,
  pointers: Readonly<Record<TransactionField, string>>,
): ProblemFieldError[] {
  return [{ pointer: pointers[rejection.field], code: rejection.code }];
}

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
const LOCATION_HEADER = "Location";
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
const transactionCreationCommandMiddleware = createCommandMiddleware(
  createTransactionRequestSchema,
);
const transactionUpdateCommandMiddleware = createCommandMiddleware(
  updateTransactionRequestSchema,
);

export function createTransactionRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .post(
      COLLECTION_PATH,
      describeRoute({
        operationId: "createTransaction",
        summary: "Create an income, expense, transfer, or refund",
        description:
          "Records income, expense, a wallet transfer, or a refund for the " +
          "signed-in owner using an exact THB amount and a real calendar date. " +
          "Income and expense requests name a matching category and active " +
          "owned wallet; transfers name distinct active owned source and " +
          "destination wallets; refunds name an active owned receiving wallet " +
          "and one of the owner's own expenses, follow the expense's category, " +
          "and cannot exceed what remains of it. The request must carry a " +
          "client-generated Idempotency-Key: repeating it with the same " +
          "normalized payload replays the original detail, while a different " +
          "payload is a conflict. A rejected request never consumes its key.",
        tags: ["Transactions"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      idempotencyKeyMiddleware,
      transactionCreationCommandMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        CreateTransactionValidatedInput,
        {
          201: typeof transactionResponseSchema;
          409: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const created = await createTransaction(db, {
            ownerId: c.get("session").user.id,
            idempotencyKey: c.req.valid("header")["idempotency-key"],
            type: body.type,
            amount: body.amount.amountInMinorUnits,
            currency: body.amount.currency,
            walletId: body.walletId,
            categoryId:
              body.type === "transfer" || body.type === "refund"
                ? null
                : body.categoryId,
            destinationWalletId:
              body.type === "transfer" ? body.destinationWalletId : null,
            refundOfTransactionId:
              body.type === "refund" ? body.refundOfTransactionId : null,
            transactionDate: body.transactionDate,
            note: body.note,
          });
          if (!created.ok) {
            if (created.error.code === "idempotency-conflict") {
              return createProblemResponse(c, idempotencyConflictProblem);
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: toFieldErrors(created.error, CREATE_FIELD_POINTERS),
            });
          }
          const transaction = presentTransaction(created.value.transaction);
          return c.json(transaction, 201, {
            [LOCATION_HEADER]: `${c.req.path}/${transaction.id}`,
          });
        },
        {
          201: {
            description: "The created transaction, or the original on a replay",
            headers: {
              [LOCATION_HEADER]: {
                description: "Where the created transaction can be retrieved",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": { vSchema: transactionResponseSchema },
            },
          },
          409: describeProblem(idempotencyConflictProblem),
          422: describeProblem(getProblemOptionsForStatus(422)),
        },
      ),
    )
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
        QueryValidatedInput<typeof transactionListQuerySchema>,
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
    .put(
      RESOURCE_PATH,
      describeRoute({
        operationId: "updateTransaction",
        summary: "Update a transaction",
        description:
          "Corrects one of the signed-in owner's transactions with an exact " +
          "THB amount and a real calendar date. The transaction's type and " +
          "its expense link are fixed; the wallet, category, amount, date, " +
          "and note are re-validated against the owner's records, and the " +
          "transaction may keep the archived wallets it already has. An " +
          "expense still covers every linked refund, and a refund stays " +
          "within what remains of its expense. An update that changes " +
          "nothing succeeds without effect, so a client may safely retry. " +
          "A transaction that does not exist, has been deleted, belongs to " +
          "another owner, or has a malformed identifier is not found alike.",
        tags: ["Transactions"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      transactionParamMiddleware,
      transactionUpdateCommandMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        ResourceCommandValidatedInput<
          typeof transactionParamsSchema,
          typeof updateTransactionRequestSchema
        >,
        {
          200: typeof transactionResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const updated = await updateTransaction(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").transactionId,
            walletId: body.walletId,
            categoryId: body.categoryId ?? null,
            destinationWalletId: body.destinationWalletId ?? null,
            currency: "THB",
            amount: body.amount.amountInMinorUnits,
            transactionDate: body.transactionDate,
            note: body.note,
          });
          if (!updated.ok) {
            if (updated.error.code === "transaction-not-found") {
              return createProblemResponse(c, getProblemOptionsForStatus(404));
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: toFieldErrors(updated.error, UPDATE_FIELD_POINTERS),
            });
          }
          return c.json(presentTransaction(updated.value), 200);
        },
        {
          200: {
            description: "The updated transaction",
            content: {
              "application/json": { vSchema: transactionResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
          422: describeProblem(getProblemOptionsForStatus(422)),
        },
      ),
    )
    .delete(
      RESOURCE_PATH,
      describeRoute({
        operationId: "deleteTransaction",
        summary: "Delete a transaction",
        description:
          "Removes one of the signed-in owner's transactions from current " +
          "history while retaining the internal record, writing its change " +
          "history atomically with the deletion. An expense that still has " +
          "linked refunds stays; delete each refund first. Repeating a " +
          "deletion succeeds without effect, so a client may safely retry. " +
          "A transaction that does not exist, belongs to another owner, or " +
          "has a malformed identifier is not found alike.",
        tags: ["Transactions"],
        responses: {
          204: { description: "The transaction was deleted" },
          401: describeProblemResponse(401),
          404: describeProblemResponse(404),
          409: describeProblemResponse(409),
        },
      }),
      transactionParamMiddleware,
      async (c) => {
        const deleted = await deleteTransaction(db, {
          ownerId: c.get("session").user.id,
          id: c.req.valid("param").transactionId,
        });
        if (!deleted.ok) {
          if (deleted.error.code === "transaction-not-found") {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return createProblemResponse(c, getProblemOptionsForStatus(409));
        }
        return c.body(null, 204);
      },
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
