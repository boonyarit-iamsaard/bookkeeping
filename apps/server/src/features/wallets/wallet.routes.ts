import type {
  ReplaceWalletOpeningError,
  WalletCreationIssue,
} from "@bookkeeping/application/wallets";
import {
  createWallet,
  deleteWallet,
  findWallet,
  listWallets,
  replaceWalletOpening,
  setWalletArchived,
} from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
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
} from "../../core/http/openapi.js";
import type {
  ProblemFieldError,
  problemDetailsSchema,
} from "../../core/http/problem-details.js";
import {
  createProblemResponse,
  getProblemOptionsForStatus,
} from "../../core/http/problem-details.js";
import type { ResourceCommandValidatedInput } from "../../core/http/request-validation.js";
import {
  createCommandMiddleware,
  createQueryMiddleware,
  createResourceParamMiddleware,
} from "../../core/http/request-validation.js";

export const walletResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: z.enum(WALLET_TYPES),
    currency: currencySchema,
    openingAmount: moneySchema,
    openingDate: z.iso.date(),
    archivedAt: z.iso.datetime().nullable(),
    balance: moneySchema,
  })
  .meta({ id: "Wallet" });

export const walletCollectionResponseSchema = createCollectionResponseSchema(
  walletResponseSchema,
).meta({ id: "WalletCollection" });

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
    balance: presentMoney({
      amountInMinorUnits: wallet.balance,
      currency: wallet.currency,
    }),
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

interface WalletListValidatedInput {
  in: { query: z.input<typeof walletListQuerySchema> };
  out: { query: z.output<typeof walletListQuerySchema> };
}

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

// The money object nests its value, so the pointer reaches inside it.
const WALLET_ISSUE_POINTERS: Record<WalletCreationIssue["field"], string> = {
  name: "#/name",
  openingAmount: "#/openingAmount/value",
  openingDate: "#/openingDate",
};

function toWalletFieldError(issue: WalletCreationIssue): ProblemFieldError {
  return { pointer: WALLET_ISSUE_POINTERS[issue.field], code: issue.code };
}

/** The opening balance as its own resource: amount and date replaced together. */
export const walletOpeningRequestSchema = z
  .object({
    amount: moneyInputSchema,
    date: z.iso.date(),
  })
  .meta({ id: "WalletOpeningRequest" });

// The opening resource names its fields without the prefix the wallet
// representation carries, so its pointers differ from the creation ones.
const OPENING_ISSUE_POINTERS = {
  openingAmount: "#/amount/value",
  openingDate: "#/date",
} as const;

/**
 * Every opening rejection short of "not found" is addressed to a field: an
 * invalid value to its own, and a movement before the proposed opening to
 * the date, since choosing an earlier date is the correction.
 */
function toOpeningFieldErrors(
  error: Exclude<ReplaceWalletOpeningError, { code: "wallet-not-found" }>,
): ProblemFieldError[] {
  if (error.code === "movement-before-opening") {
    return [{ pointer: OPENING_ISSUE_POINTERS.openingDate, code: error.code }];
  }
  return error.issues.map((issue) => ({
    pointer: OPENING_ISSUE_POINTERS[issue.field],
    code: issue.code,
  }));
}

/** The archived state as its own partial update: the only mutable field. */
export const walletArchiveStateRequestSchema = z
  .strictObject({ archived: z.boolean() })
  .meta({ id: "WalletArchiveStateRequest" });

const LOCATION_HEADER = "Location";
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
          422: typeof problemDetailsSchema;
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
          });
          if (!created.ok) {
            if (created.error.code === "idempotency-conflict") {
              return createProblemResponse(c, idempotencyConflictProblem);
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: created.error.issues.map(toWalletFieldError),
            });
          }
          const wallet = presentWallet(created.value.wallet);
          // The mount prefix is only known from the request, so the location
          // is built from the collection path actually served.
          return c.json(wallet, 201, {
            [LOCATION_HEADER]: `${c.req.path}/${wallet.id}`,
          });
        },
        {
          201: {
            description: "The created wallet, or the original on a replay",
            headers: {
              [LOCATION_HEADER]: {
                description: "Where the created wallet can be retrieved",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": { vSchema: walletResponseSchema },
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
        operationId: "listWallets",
        summary: "List wallets",
        description:
          "Every wallet the signed-in owner holds, archived ones included, " +
          "in creation order with an end-of-day balance in Bangkok. The " +
          "optional `asOf` calendar date reports balances as they stood at " +
          "the end of that day, counting the opening amount and every " +
          "transaction dated on or before it; omitting it reports today's. " +
          "A date before a wallet opened reports zero, and a malformed " +
          "date or an unknown parameter is a bad request. The collection " +
          "is small and unpaginated; `nextCursor` is always null.",
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
        WalletListValidatedInput,
        {
          200: typeof walletCollectionResponseSchema;
          400: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const { asOf } = c.req.valid("query");
          const wallets = await listWallets(db, {
            ownerId: c.get("session").user.id,
            ...(asOf === undefined ? {} : { asOf }),
          });
          return c.json(
            { items: wallets.map(presentWallet), page: { nextCursor: null } },
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
          if (wallet === null) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(presentWallet(wallet), 200);
        },
        {
          200: {
            description: "The wallet",
            content: {
              "application/json": { vSchema: walletResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
        },
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
          422: typeof problemDetailsSchema;
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
          if (!replaced.ok) {
            if (replaced.error.code === "wallet-not-found") {
              return createProblemResponse(c, getProblemOptionsForStatus(404));
            }
            return createProblemResponse(c, {
              ...getProblemOptionsForStatus(422),
              errors: toOpeningFieldErrors(replaced.error),
            });
          }
          return c.json(presentWallet(replaced.value), 200);
        },
        {
          200: {
            description: "The wallet with its replaced opening balance",
            content: {
              "application/json": { vSchema: walletResponseSchema },
            },
          },
          404: describeProblem(getProblemOptionsForStatus(404)),
          422: describeProblem(getProblemOptionsForStatus(422)),
        },
      ),
    )
    .patch(
      RESOURCE_PATH,
      describeRoute({
        operationId: "changeWalletArchiveState",
        summary: "Change a wallet's archived state",
        description:
          "Archives the wallet by stamping the archived instant, or restores " +
          "it by clearing it. Repeating the current state succeeds without " +
          "effect, so a client may safely retry. A wallet that does not " +
          "exist, belongs to another owner, or has a malformed identifier is " +
          "not found alike.",
        tags: ["Wallets"],
        responses: {
          400: describeProblemResponse(400),
          401: describeProblemResponse(401),
        },
      }),
      walletParamMiddleware,
      createCommandMiddleware(walletArchiveStateRequestSchema),
      describeResponse<
        AuthenticatedEnv,
        typeof RESOURCE_PATH,
        WalletCommandValidatedInput<typeof walletArchiveStateRequestSchema>,
        {
          200: typeof walletResponseSchema;
          404: typeof problemDetailsSchema;
          422: typeof problemDetailsSchema;
        }
      >(
        async (c) => {
          const body = c.req.valid("json");
          const changed = await setWalletArchived(db, {
            ownerId: c.get("session").user.id,
            id: c.req.valid("param").walletId,
            archived: body.archived,
          });
          if (!changed.ok) {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return c.json(presentWallet(changed.value), 200);
        },
        {
          200: {
            description: "The wallet with its changed archived state",
            content: {
              "application/json": { vSchema: walletResponseSchema },
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
          409: describeProblemResponse(409),
        },
      }),
      walletParamMiddleware,
      async (c) => {
        const deleted = await deleteWallet(db, {
          ownerId: c.get("session").user.id,
          id: c.req.valid("param").walletId,
        });
        if (!deleted.ok) {
          if (deleted.error.code === "wallet-not-found") {
            return createProblemResponse(c, getProblemOptionsForStatus(404));
          }
          return createProblemResponse(c, getProblemOptionsForStatus(409));
        }
        return c.body(null, 204);
      },
    );
}
