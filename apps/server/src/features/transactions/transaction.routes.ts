import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@bookkeeping/application/transactions";
import {
  findExpenseRefunds,
  findLastUsedWalletId,
  findTransaction,
} from "@bookkeeping/application/transactions/reads";
import type { Database } from "@bookkeeping/database/connection";
import {
  carriesOwnCategory,
  carriesOwnTags,
} from "@bookkeeping/domain/transactions";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { readIdempotencyKey } from "../../core/http/idempotency.js";
import {
  describeProblem,
  describeProblemResponse,
  describeProblemVariant,
} from "../../core/http/openapi.js";
import type { problemDetailsSchema } from "../../core/http/problem-details.js";
import { getProblemOptionsForStatus } from "../../core/http/problem-details.js";

import type {
  CreationValidatedInput,
  QueryValidatedInput,
  ResourceCommandValidatedInput,
} from "../../core/http/request-validation.js";
import {
  createCommandMiddleware,
  createCreationMiddleware,
  createQueryMiddleware,
  createResourceParamMiddleware,
} from "../../core/http/request-validation.js";

import {
  answerCorrection,
  answerCreation,
  answerRead,
  answerRemoval,
  describeCorrection,
  describeCreation,
  describeRead,
} from "../../core/http/resource-answers.js";
import {
  createTransactionRequestSchema,
  presentTransaction,
  presentTransactionRefund,
  presentTransactionRefunds,
  refundsExistProblem,
  refundsExistProblemSchema,
  transactionCollectionResponseSchema,
  transactionEntryDefaultsResponseSchema,
  transactionRefundsResponseSchema,
  transactionResponseSchema,
  updateTransactionRequestSchema,
} from "./transaction.schemas.js";
import type { transactionListQuerySchema } from "./transaction-list.js";
import {
  readTransactionList,
  transactionListQueryMiddleware,
} from "./transaction-list.js";
import type { transactionRejectionProblemSchema } from "./transaction-rejection.js";
import {
  toCreateFieldErrors,
  toUpdateFieldErrors,
  transactionCodes,
} from "./transaction-rejection.js";

// Registered before the resource path so the static entry-defaults read is
// never captured by the identifier route.
const COLLECTION_PATH = "/transactions";
const ENTRY_DEFAULTS_PATH = "/transactions/entry-defaults";
const RESOURCE_PATH = "/transactions/:transactionId";
const REFUNDS_PATH = "/transactions/:transactionId/refunds";

const transactionRefundsQuerySchema = z.strictObject({
  excluding: z.uuid().optional(),
});

const transactionRefundsQueryMiddleware = createQueryMiddleware(
  transactionRefundsQuerySchema,
);

const transactionParamsSchema = z.object({ transactionId: z.uuid() });
const transactionParamMiddleware = createResourceParamMiddleware(
  transactionParamsSchema,
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
          "owned wallet and may carry the owner's tags; transfers name " +
          "distinct active owned source and destination wallets; refunds " +
          "name an active owned receiving wallet and one of the owner's own " +
          "expenses, follow the expense's category and tags, and cannot " +
          "exceed what remains of it. The request must carry a " +
          "client-generated Idempotency-Key, and a rejected request never " +
          "consumes it.",
        tags: ["Transactions"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      ...createCreationMiddleware(createTransactionRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        CreationValidatedInput<typeof createTransactionRequestSchema>,
        {
          201: typeof transactionResponseSchema;
          409: typeof problemDetailsSchema;
          422: typeof transactionRejectionProblemSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const created = await createTransaction(db, {
            ownerId: c.get("session").user.id,
            idempotencyKey: readIdempotencyKey(c),
            type: body.type,
            amount: body.amount.amountInMinorUnits,
            walletId: body.walletId,
            categoryId: carriesOwnCategory(body) ? body.categoryId : null,
            destinationWalletId:
              body.type === "transfer" ? body.destinationWalletId : null,
            refundOfTransactionId:
              body.type === "refund" ? body.refundOfTransactionId : null,
            transactionDate: body.transactionDate,
            note: body.note,
            tagIds: carriesOwnTags(body) ? body.tagIds : [],
          });
          return answerCreation(c, {
            result: created,
            present: presentTransaction,
            toFieldErrors: toCreateFieldErrors,
          });
        },
        {
          ...describeCreation("transaction", transactionResponseSchema),
          422: transactionCodes.describeRejection(),
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
          "Date, wallet, category, type, and tag filters preserve transfer, " +
          "parent category, refund, and ownership semantics; repeated tag " +
          "ids match any of them, and a refund matches through its " +
          "expense's tags. The list comes in numbered pages: `page` (from " +
          "1), `pageSize` (10, 25, 50, or 100; default 50), `sort` (`date` " +
          "or `amount`, by size; default `date`), and `order` (default " +
          "`desc`); the response carries the filtered `total`, and ties " +
          "break by recording time, then identifier.",
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
          const list = await readTransactionList(db, {
            ownerId: c.get("session").user.id,
            query: c.req.valid("query"),
          });
          return c.json(list, 200);
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
          return answerRead(c, {
            value: transaction,
            present: presentTransaction,
          });
        },
        describeRead("The transaction", transactionResponseSchema),
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
          "note, and tags are re-validated against the owner's records, and the " +
          "transaction may keep the archived wallets it already has. An " +
          "expense still covers every linked refund, and a refund stays " +
          "within what remains of its expense. `tagIds` lists every tag; " +
          "an empty list removes them. An update that changes nothing " +
          "succeeds without effect, so a client may safely retry. " +
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
          422: typeof transactionRejectionProblemSchema;
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
            amount: body.amount.amountInMinorUnits,
            transactionDate: body.transactionDate,
            note: body.note,
            tagIds: body.tagIds,
          });
          return answerCorrection(c, {
            result: updated,
            present: presentTransaction,
            toFieldErrors: toUpdateFieldErrors,
          });
        },
        {
          ...describeCorrection(
            "The updated transaction",
            transactionResponseSchema,
          ),
          422: transactionCodes.describeRejection(),
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
          "linked refunds stays and lists them in its conflict problem; " +
          "delete each refund first. Repeating a deletion succeeds without " +
          "effect, so a client may safely retry. A transaction that does not " +
          "exist, belongs to another owner, or has a malformed identifier is " +
          "not found alike.",
        tags: ["Transactions"],
        responses: {
          204: { description: "The transaction was deleted" },
          401: describeProblemResponse(401),
          404: describeProblemResponse(404),
          409: describeProblemVariant(
            refundsExistProblem,
            refundsExistProblemSchema,
          ),
        },
      }),
      transactionParamMiddleware,
      async (c) => {
        const deleted = await deleteTransaction(db, {
          ownerId: c.get("session").user.id,
          id: c.req.valid("param").transactionId,
        });
        return answerRemoval(c, {
          result: deleted,
          toBlockerProblem: (blocker) => ({
            ...refundsExistProblem,
            extensions: {
              refunds: blocker.refunds.map(presentTransactionRefund),
            },
          }),
        });
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
          "is not found alike. Naming a refund in `excluding` leaves it " +
          "out, so the allowance is what that refund may take when corrected.",
        tags: ["Transactions"],
        responses: { 401: describeProblemResponse(401) },
      }),
      transactionParamMiddleware,
      transactionRefundsQueryMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof REFUNDS_PATH,
        QueryValidatedInput<typeof transactionRefundsQuerySchema>,
        {
          200: typeof transactionRefundsResponseSchema;
          400: typeof problemDetailsSchema;
          404: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const refunds = await findExpenseRefunds(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("transactionId"),
            excluding: c.req.valid("query").excluding,
          });
          return answerRead(c, {
            value: refunds,
            present: presentTransactionRefunds,
          });
        },
        {
          ...describeRead(
            "The expense's refunds and refund allowance",
            transactionRefundsResponseSchema,
          ),
          400: describeProblem(getProblemOptionsForStatus(400)),
        },
      ),
    );
}
