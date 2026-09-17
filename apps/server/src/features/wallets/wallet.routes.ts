import type { WalletCreationIssue } from "@bookkeeping/application/wallets";
import {
  createWallet,
  findWallet,
  listWallets,
} from "@bookkeeping/application/wallets";
import type { Database } from "@bookkeeping/database/connection";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import { WALLET_TYPES } from "@bookkeeping/domain/wallets";
import type { Input } from "hono";
import { Hono } from "hono";
import { describeResponse, describeRoute, validator } from "hono-openapi";
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
import { describeProblemResponse } from "../../core/http/openapi.js";
import type {
  ProblemFieldError,
  ProblemOptions,
} from "../../core/http/problem-details.js";
import {
  createProblemDetails,
  createProblemResponse,
  getProblemOptionsForStatus,
  PROBLEM_MEDIA_TYPE,
  problemDetailsSchema,
} from "../../core/http/problem-details.js";
import { createInvalidCommandProblem } from "../../core/http/request-validation.js";

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

const walletParamsSchema = z.object({ walletId: z.uuid() });

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

function describeProblem(problem: Readonly<ProblemOptions>) {
  return {
    description: problem.title,
    content: { [PROBLEM_MEDIA_TYPE]: { vSchema: problemDetailsSchema } },
  };
}

const LOCATION_HEADER = "Location";
const COLLECTION_PATH = "/wallets";
const RESOURCE_PATH = "/wallets/:walletId";

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
      validator("json", createWalletRequestSchema, (result, c) => {
        if (!result.success) {
          return createProblemResponse(
            c,
            createInvalidCommandProblem(result.error),
          );
        }
      }),
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
              return c.json(
                createProblemDetails(idempotencyConflictProblem),
                409,
                {
                  "Content-Type": PROBLEM_MEDIA_TYPE,
                },
              );
            }
            return c.json(
              createProblemDetails({
                ...getProblemOptionsForStatus(422),
                errors: created.error.issues.map(toWalletFieldError),
              }),
              422,
              { "Content-Type": PROBLEM_MEDIA_TYPE },
            );
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
          "in creation order with today's end-of-day balance in Bangkok. " +
          "The collection is small and unpaginated; `nextCursor` is always null.",
        tags: ["Wallets"],
        responses: { 401: describeProblemResponse(401) },
      }),
      // The generics are explicit because the library cannot infer the
      // authenticated environment from an async handler; without them the
      // session variable types as `never`.
      describeResponse<
        AuthenticatedEnv,
        typeof COLLECTION_PATH,
        Input,
        { 200: typeof walletCollectionResponseSchema }
      >(
        async (c) => {
          const wallets = await listWallets(db, {
            ownerId: c.get("session").user.id,
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
      validator("param", walletParamsSchema, (result, c) => {
        if (!result.success) {
          return createProblemResponse(c, getProblemOptionsForStatus(404));
        }
      }),
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
            return c.json(
              createProblemDetails(getProblemOptionsForStatus(404)),
              404,
              { "Content-Type": PROBLEM_MEDIA_TYPE },
            );
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
    );
}
