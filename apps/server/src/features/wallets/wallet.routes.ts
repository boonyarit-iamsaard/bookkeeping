import {
  createWallet,
  deleteWallet,
  findWallet,
  listWalletsWithBalance,
  replaceWalletOpening,
} from "@bookkeeping/application/wallets";
import { changeWalletState } from "@bookkeeping/application/wallets/state";
import type { Database } from "@bookkeeping/database/connection";
import type {
  TotalBalanceSplit,
  WalletSummary,
} from "@bookkeeping/domain/wallets";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute } from "hono-openapi";
import * as z from "zod";
import type { AuthenticatedEnv } from "../../core/auth/session.js";
import { createCollectionResponseSchema } from "../../core/http/collection.js";
import type { idempotencyKeyHeaderSchema } from "../../core/http/idempotency.js";
import { idempotencyKeyMiddleware } from "../../core/http/idempotency.js";
import type { Money } from "../../core/http/money.js";
import {
  currencySchema,
  moneyInputSchema,
  moneySchema,
  presentMoney,
} from "../../core/http/money.js";
import {
  describeProblem,
  describeProblemResponse,
  describeProblemVariant,
} from "../../core/http/openapi.js";
import type { ProblemOptions } from "../../core/http/problem-details.js";
import {
  getProblemOptionsForStatus,
  problemDetailsSchema,
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
  answerCorrection,
  answerCreation,
  answerRead,
  answerRemoval,
  describeCorrection,
  describeCreation,
  describeRead,
} from "../../core/http/resource-answers.js";
import type { walletRejectionProblemSchema } from "./wallet-rejection.js";
import {
  toCreationFieldErrors,
  toOpeningFieldErrors,
  walletCodes,
} from "./wallet-rejection.js";

export const walletResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(WALLET_TYPES),
    currency: currencySchema,
    openingAmount: moneySchema,
    openingDate: z.iso.date(),
    archivedAt: z.iso.datetime().nullable(),
    savings: z.boolean(),
    balance: moneySchema,
  })
  .meta({ id: "Wallet" });

/**
 * The Total balance over the listed wallets, archived ones included, split
 * into Spendable and Set aside. A figure is null when no wallet of its kind
 * had opened by the date; the counts cover the listed wallets.
 */
export const totalBalanceSplitSchema = z
  .object({
    total: moneySchema.nullable(),
    spendable: moneySchema.nullable(),
    setAside: moneySchema.nullable(),
    walletCount: z.int().nonnegative(),
    spendableWalletCount: z.int().nonnegative(),
    savingsWalletCount: z.int().nonnegative(),
  })
  .meta({ id: "TotalBalanceSplit" });

export const walletCollectionResponseSchema = createCollectionResponseSchema(
  walletResponseSchema,
)
  .extend({ balance: totalBalanceSplitSchema })
  .meta({ id: "WalletCollection" });

export interface WalletResponse {
  id: string;
  name: string;
  type: WalletSummary["type"];
  currency: WalletSummary["currency"];
  openingAmount: Money;
  /** Calendar date, YYYY-MM-DD; never timezone-converted. */
  openingDate: string;
  /** UTC RFC 3339 instant, or null while the wallet is active. */
  archivedAt: string | null;
  savings: boolean;
  balance: Money;
}

export function presentWallet(wallet: Readonly<WalletSummary>): WalletResponse {
  return {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    currency: wallet.currency,
    openingAmount: presentMoney({
      amountInMinorUnits: wallet.openingAmount,
      currency: wallet.currency,
    }),
    openingDate: wallet.openingDate,
    archivedAt: wallet.archivedAt?.toISOString() ?? null,
    savings: wallet.savings,
    balance: presentMoney({
      amountInMinorUnits: wallet.balance,
      currency: wallet.currency,
    }),
  };
}

function presentAmount(amountInMinorUnits: bigint | null): Money | null {
  return amountInMinorUnits === null
    ? null
    : presentMoney({ amountInMinorUnits, currency: "THB" });
}

export function presentTotalBalanceSplit(
  balance: Readonly<TotalBalanceSplit>,
): z.infer<typeof totalBalanceSplitSchema> {
  return {
    ...balance,
    total: presentAmount(balance.total),
    spendable: presentAmount(balance.spendable),
    setAside: presentAmount(balance.setAside),
  };
}

/**
 * The collection reports end-of-day balances on one Bangkok calendar date.
 * Omitting the date reports today's, which is what the picker starts from.
 */
export const walletListQuerySchema = z.strictObject({
  asOf: z.iso
    .date()
    .meta({ description: "End-of-day balance date, YYYY-MM-DD" })
    .optional(),
});

const walletListQueryMiddleware = createQueryMiddleware(walletListQuerySchema);

const walletParamsSchema = z.object({ walletId: z.uuid() });
const walletParamMiddleware = createResourceParamMiddleware(walletParamsSchema);

type WalletCommandValidatedInput<Schema extends z.ZodType> =
  ResourceCommandValidatedInput<typeof walletParamsSchema, Schema>;

export const createWalletRequestSchema = z
  .object({
    name: z.string(),
    type: z.enum(WALLET_TYPES),
    openingAmount: moneyInputSchema,
    openingDate: z.iso.date(),
    savings: z.boolean().optional(),
  })
  .meta({ id: "CreateWalletRequest" });

/** What the validators hand the creation handler. */
interface CreateWalletValidatedInput {
  in: {
    json: z.input<typeof createWalletRequestSchema>;
    header: z.input<typeof idempotencyKeyHeaderSchema>;
  };
  out: {
    json: z.output<typeof createWalletRequestSchema>;
    header: z.output<typeof idempotencyKeyHeaderSchema>;
  };
}

/** The opening balance as its own resource: amount and date replaced together. */
export const walletOpeningRequestSchema = z
  .object({
    amount: moneyInputSchema,
    date: z.iso.date(),
  })
  .meta({ id: "WalletOpeningRequest" });

/** Archive and Savings wallet markers can change independently. */
export const walletStateRequestSchema = z
  .strictObject({
    archived: z.boolean().optional(),
    savings: z.boolean().optional(),
  })
  .refine(
    (state) => state.archived !== undefined || state.savings !== undefined,
    { error: "Provide at least one wallet state field" },
  )
  .meta({ id: "WalletStateRequest" });

/** The 409 a wallet answers while transactions or history still refer to it. */
export const historyRemainsProblemSchema = problemDetailsSchema
  .extend({ code: z.literal("history-remains") })
  .meta({ id: "HistoryRemainsProblem" });

export const historyRemainsProblem: ProblemOptions<409> = {
  code: "history-remains",
  status: 409,
  title: "Wallet still has transactions or history",
};

const COLLECTION_PATH = "/wallets";
const RESOURCE_PATH = "/wallets/:walletId";
const OPENING_PATH = "/wallets/:walletId/opening";

export function createWalletRoutes(db: Database) {
  return new Hono<AuthenticatedEnv>()
    .post(
      COLLECTION_PATH,
      describeRoute({
        operationId: "createWallet",
        summary: "Create a wallet",
        description:
          "Opens a wallet for the signed-in owner with an exact opening " +
          "balance on a calendar date no later than today in Bangkok. The " +
          "request must carry a client-generated Idempotency-Key: repeating " +
          "it with the same payload replays the original creation, while a " +
          "different payload under the same key is a conflict. A rejected " +
          "request never consumes its key.",
        tags: ["Wallets"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      idempotencyKeyMiddleware,
      createCommandMiddleware(createWalletRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        CreateWalletValidatedInput,
        {
          201: typeof walletResponseSchema;
          409: typeof problemDetailsSchema;
          422: typeof walletRejectionProblemSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const created = await createWallet(db, {
            ownerId: c.get("session").user.id,
            idempotencyKey: c.req.valid("header")["idempotency-key"],
            name: body.name,
            type: body.type,
            openingAmount: body.openingAmount.amountInMinorUnits,
            openingDate: body.openingDate,
            savings: body.savings ?? false,
          });
          return answerCreation(c, {
            result: created,
            present: presentWallet,
            toFieldErrors: toCreationFieldErrors,
          });
        },
        {
          ...describeCreation("wallet", walletResponseSchema),
          422: walletCodes.describeRejection(),
        },
      ),
    )
    .get(
      COLLECTION_PATH,
      describeRoute({
        operationId: "listWallets",
        summary: "List wallets",
        description:
          "Every wallet the signed-in owner holds, archived ones included, " +
          "in creation order with an end-of-day balance in Bangkok. The " +
          "optional `asOf` calendar date reports balances as they stood at " +
          "the end of that day, counting the opening amount and every " +
          "transaction dated on or before it; omitting it reports today's. " +
          "A wallet not yet opened by that date is left out, and " +
          "`balance` splits the Total balance of the listed wallets into " +
          "Spendable and Set aside. A malformed date or an unknown " +
          "parameter is a bad request. The collection is small and " +
          "unpaginated; `nextCursor` is always null.",
        tags: ["Wallets"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      walletListQueryMiddleware,
      // The generics are explicit because the library cannot infer the
      // authenticated environment from an async handler; without them the
      // session variable types as `never`.
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        QueryValidatedInput<typeof walletListQuerySchema>,
        {
          200: typeof walletCollectionResponseSchema;
          400: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const { asOf } = c.req.valid("query");
          const listed = await listWalletsWithBalance(db, {
            ownerId: c.get("session").user.id,
            ...(asOf === undefined ? {} : { asOf }),
          });
          return c.json(
            {
              items: listed.wallets.map(presentWallet),
              page: { nextCursor: null },
              balance: presentTotalBalanceSplit(listed.balance),
            },
            200,
          );
        },
        {
          200: {
            description: "The owner's wallets",
            content: {
              "application/json": { vSchema: walletCollectionResponseSchema },
            },
          },
          400: describeProblem(getProblemOptionsForStatus(400)),
        },
      ),
    )
    .get(
      RESOURCE_PATH,
      describeRoute({
        operationId: "getWallet",
        summary: "Get a wallet",
        description:
          "One wallet the signed-in owner holds, with today's end-of-day " +
          "balance in Bangkok. A wallet that does not exist, belongs to " +
          "another owner, or has a malformed identifier is not found alike.",
        tags: ["Wallets"],
        responses: { 401: describeProblemResponse(401) },
      }),
      walletParamMiddleware,
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        Input,
        { 200: typeof walletResponseSchema; 404: typeof problemDetailsSchema }
      >(
        async (c) => {
          const wallet = await findWallet(db, {
            ownerId: c.get("session").user.id,
            id: c.req.param("walletId"),
          });
          return answerRead(c, { value: wallet, present: presentWallet });
        },
        describeRead("The wallet", walletResponseSchema),
      ),
    )
    .put(
      OPENING_PATH,
      describeRoute({
        operationId: "replaceWalletOpening",
        summary: "Replace a wallet's opening balance",
        description:
          "Replaces the opening amount and opening date together as one " +
          "resource. The date must be a calendar date no later than today " +
          "in Bangkok and no later than any movement the wallet has ever " +
          "carried, deleted ones included. Replacing an opening with itself " +
          "succeeds without effect, so a client may safely retry. A wallet " +
          "that does not exist, belongs to another owner, or has a " +
          "malformed identifier is not found alike.",
        tags: ["Wallets"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      walletParamMiddleware,
      createCommandMiddleware(walletOpeningRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof OPENING_PATH,
        WalletCommandValidatedInput<typeof walletOpeningRequestSchema>,
        {
          200: typeof walletResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof walletRejectionProblemSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const replaced = await replaceWalletOpening(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").walletId,
            openingAmount: body.amount.amountInMinorUnits,
            openingDate: body.date,
          });
          return answerCorrection(c, {
            result: replaced,
            present: presentWallet,
            toFieldErrors: toOpeningFieldErrors,
          });
        },
        {
          ...describeCorrection(
            "The wallet with its replaced opening balance",
            walletResponseSchema,
          ),
          422: walletCodes.describeRejection(),
        },
      ),
    )
    .patch(
      RESOURCE_PATH,
      describeRoute({
        operationId: "changeWalletState",
        summary: "Change a wallet's state",
        description:
          "Changes the archived state, the Savings wallet marker, or both. " +
          "Omitted fields stay unchanged. Repeating the current state is a " +
          "retry-safe no-op. A wallet that does not exist, belongs to another " +
          "owner, or has a malformed identifier is not found alike.",
        tags: ["Wallets"],
        requestBody: { required: true, content: {} },
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      walletParamMiddleware,
      createCommandMiddleware(walletStateRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        WalletCommandValidatedInput<typeof walletStateRequestSchema>,
        {
          200: typeof walletResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const changed = await changeWalletState(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").walletId,
            ...(body.archived === undefined ? {} : { archived: body.archived }),
            ...(body.savings === undefined ? {} : { savings: body.savings }),
          });
          // Only not-found can refuse this; the command middleware owns the 422.
          return answerCorrection(c, {
            result: changed,
            present: presentWallet,
            toFieldErrors: () => [],
          });
        },
        describeCorrection(
          "The wallet with its changed state",
          walletResponseSchema,
        ),
      ),
    )
    .delete(
      RESOURCE_PATH,
      describeRoute({
        operationId: "deleteWallet",
        summary: "Delete a wallet",
        description:
          "Permanently removes a wallet only when it has no current " +
          "transactions, wallet changes, or retained transaction snapshots. " +
          "A wallet that does not exist, belongs to another owner, or has a " +
          "malformed identifier is not found alike.",
        tags: ["Wallets"],
        responses: {
          204: { description: "The wallet was deleted" },
          401: describeProblemResponse(401),
          404: describeProblemResponse(404),
          409: describeProblemVariant(
            historyRemainsProblem,
            historyRemainsProblemSchema,
          ),
        },
      }),
      walletParamMiddleware,
      async (c) => {
        const deleted = await deleteWallet(db, {
          ownerId: c.get("session").user.id,
          id: c.req.valid("param").walletId,
        });
        return answerRemoval(c, {
          result: deleted,
          toBlockerProblem: () => historyRemainsProblem,
        });
      },
    );
}
