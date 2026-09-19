import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import * as z from "zod";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
  categoryUsageCollectionResponseSchema,
  categoryUsageResponseSchema,
  provisioningOutcomeResponseSchema,
} from "../../features/categories/category.routes.js";
import { healthResponseSchema } from "../../features/health/health.routes.js";
import { monthlyReportResponseSchema } from "../../features/reports/report.routes.js";
import {
  transactionCollectionResponseSchema,
  transactionEntryDefaultsResponseSchema,
  transactionRefundsResponseSchema,
  transactionResponseSchema,
} from "../../features/transactions/transaction.routes.js";
import {
  walletCollectionResponseSchema,
  walletResponseSchema,
} from "../../features/wallets/wallet.routes.js";
import {
  createIntegrationTestApp,
  signUpThroughAuthRoutes,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { IDEMPOTENCY_KEY_HEADER } from "./idempotency.js";
import { OPENAPI_DOCUMENT_PATH } from "./openapi.js";
import type { ProblemCode } from "./problem-details.js";
import {
  PROBLEM_MEDIA_TYPE,
  problemCodes,
  problemDetailsSchema,
} from "./problem-details.js";
import type { AppEnv } from "./request-context.js";

const { withRollback } = setupTestDatabase();

/**
 * Mappings the transport owns for statuses no current operation answers
 * with. They stay covered by `problem-details.unit.test.ts` rather than by
 * an HTTP exchange; a code that starts being answered moves out of here.
 */
const UNANSWERED_PROBLEM_CODES: readonly ProblemCode[] = [
  "forbidden",
  "method-not-allowed",
  "rate-limited",
  "service-unavailable",
];

interface DocumentedMedia {
  schema: { $ref?: string };
}

interface DocumentedOperation {
  operationId?: string;
  responses: {
    [status: string]: {
      content?: { [mediaType: string]: DocumentedMedia };
    };
  };
}

interface OpenApiDocument {
  paths: { [path: string]: { [method: string]: DocumentedOperation } };
}

/** One published operation answering one documented response. */
interface ContractExchange {
  operationId: string;
  method: string;
  path: string;
  response: Response;
  /** The schema the document must name; a bodyless response names none. */
  schema?: z.ZodType;
}

function documentedOperation(
  document: Readonly<OpenApiDocument>,
  exchange: Readonly<Pick<ContractExchange, "method" | "path">>,
): DocumentedOperation {
  const operation = document.paths[exchange.path]?.[exchange.method];
  if (operation === undefined) {
    throw new Error(`Undocumented ${exchange.method} ${exchange.path}`);
  }
  return operation;
}

/**
 * Asserts one exchange against the document that describes it: the operation
 * is published under the expected identifier, the status is documented, the
 * media type and schema reference match, and the actual body parses.
 */
async function expectDocumentedExchange(
  document: Readonly<OpenApiDocument>,
  exchange: Readonly<ContractExchange>,
): Promise<void> {
  const operation = documentedOperation(document, exchange);
  expect(operation.operationId).toBe(exchange.operationId);

  const status = String(exchange.response.status);
  const documented = operation.responses[status];
  expect(
    documented,
    `${exchange.operationId} answered an undocumented ${status}`,
  ).toBeDefined();

  if (exchange.schema === undefined) {
    expect(documented.content).toBeUndefined();
    expect(exchange.response.headers.get("content-type")).toBeNull();
    expect(await exchange.response.clone().text()).toBe("");
    return;
  }

  const [mediaType, media] = Object.entries(documented.content ?? {})[0];
  expect(exchange.response.headers.get("content-type")).toContain(mediaType);
  expect(media.schema.$ref).toBe(
    `#/components/schemas/${exchange.schema.meta()?.id}`,
  );
  const body: unknown = await exchange.response.clone().json();
  const parsed = exchange.schema.safeParse(body);
  expect(
    parsed.error?.issues,
    `${exchange.operationId} answered a body its schema rejects`,
  ).toBeUndefined();
  // Presented values are JSON throughout: no bigint or Date reaches the
  // wire, so the parsed body round-trips to exactly what was sent.
  expect(JSON.parse(JSON.stringify(parsed.data))).toEqual(body);
}

const sessionResponseSchema = z.object({ user: z.object({ id: z.string() }) });

async function signUp(app: Hono<AppEnv>) {
  const { cookie } = await signUpThroughAuthRoutes(app, "contract");
  const session = await app.request(`${TEST_API_ORIGIN}/api/auth/get-session`, {
    headers: { cookie, origin: TEST_CLIENT_ORIGIN },
  });
  sessionResponseSchema.parse(await session.json());
  return cookie;
}

interface ApiRequest {
  method?: string;
  path: string;
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
}

function createClient(app: Hono<AppEnv>, cookie: string) {
  return async function call({
    method = "GET",
    path,
    cookie: override,
    idempotencyKey,
    body,
  }: Readonly<ApiRequest>): Promise<Response> {
    const session = override === undefined ? cookie : override;
    return app.request(`${TEST_API_ORIGIN}${path}`, {
      method,
      headers: {
        origin: TEST_CLIENT_ORIGIN,
        ...(session === "" ? {} : { cookie: session }),
        ...(idempotencyKey === undefined
          ? {}
          : { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };
}

type ApiClient = ReturnType<typeof createClient>;

async function fetchDocument(app: Hono<AppEnv>): Promise<OpenApiDocument> {
  return (
    await app.request(`${TEST_API_ORIGIN}${OPENAPI_DOCUMENT_PATH}`)
  ).json();
}

function publishedOperationIds(document: Readonly<OpenApiDocument>): string[] {
  return Object.values(document.paths)
    .flatMap((methods) => Object.values(methods))
    .flatMap((operation) =>
      operation.operationId === undefined ? [] : [operation.operationId],
    );
}

/** The wire form of an exact baht amount. */
function money(value: string) {
  return { value, currency: "THB" };
}

const OPENING_DATE = "2026-09-01";
const ENTRY_DATE = "2026-09-02";
const REPORT_MONTH = "2026-09";

interface ExchangeCollector {
  exchanges: ContractExchange[];
  record: (exchange: ContractExchange) => Response;
}

function createCollector(): ExchangeCollector {
  const exchanges: ContractExchange[] = [];
  return {
    exchanges,
    record(exchange) {
      exchanges.push(exchange);
      return exchange.response;
    },
  };
}

async function readId(response: Response): Promise<string> {
  const body = z.object({ id: z.uuid() }).parse(await response.clone().json());
  return body.id;
}

/** Opens a cash wallet over HTTP under a key named for the wallet. */
async function openWallet(call: ApiClient, name: string): Promise<Response> {
  return call({
    method: "POST",
    path: "/v1/wallets",
    idempotencyKey: `wallet-${name}`,
    body: {
      name,
      type: "cash",
      openingAmount: money("1000.00"),
      openingDate: OPENING_DATE,
    },
  });
}

describe("published API contract", () => {
  test("every published operation answers its documented success response", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const cookie = await signUp(app);
      const call = createClient(app, cookie);
      const document = await fetchDocument(app);
      const { exchanges, record } = createCollector();

      record({
        operationId: "getHealth",
        method: "get",
        path: "/health",
        schema: healthResponseSchema,
        response: await call({ path: "/health", cookie: "" }),
      });

      record({
        operationId: "initializeDefaultCategories",
        method: "post",
        path: "/v1/categories/defaults",
        schema: provisioningOutcomeResponseSchema,
        response: await call({
          method: "POST",
          path: "/v1/categories/defaults",
        }),
      });

      const categoryCollection = record({
        operationId: "listCategories",
        method: "get",
        path: "/v1/categories",
        schema: categoryCollectionResponseSchema,
        response: await call({ path: "/v1/categories" }),
      });
      const { items: trees } = categoryCollectionResponseSchema.parse(
        await categoryCollection.clone().json(),
      );
      const expenseCategory = trees.find(
        (category) => category.kind === "expense" && category.parentId !== null,
      );
      if (expenseCategory === undefined) {
        throw new Error("Expected a provisioned expense child category");
      }

      const created = record({
        operationId: "createCategory",
        method: "post",
        path: "/v1/categories",
        schema: categoryResponseSchema,
        response: await call({
          method: "POST",
          path: "/v1/categories",
          idempotencyKey: "contract-category",
          body: {
            kind: "expense",
            name: "Contract",
            iconId: "beer",
            parent: null,
          },
        }),
      });
      const categoryId = await readId(created);

      record({
        operationId: "getCategory",
        method: "get",
        path: "/v1/categories/{categoryId}",
        schema: categoryResponseSchema,
        response: await call({ path: `/v1/categories/${categoryId}` }),
      });
      record({
        operationId: "updateCategory",
        method: "patch",
        path: "/v1/categories/{categoryId}",
        schema: categoryResponseSchema,
        response: await call({
          method: "PATCH",
          path: `/v1/categories/${categoryId}`,
          body: { name: "Contract renamed", iconId: "wine" },
        }),
      });
      record({
        operationId: "getCategoryUsage",
        method: "get",
        path: "/v1/categories/{categoryId}/usage",
        schema: categoryUsageResponseSchema,
        response: await call({ path: `/v1/categories/${categoryId}/usage` }),
      });
      record({
        operationId: "listCategoryUsage",
        method: "get",
        path: "/v1/categories/usage",
        schema: categoryUsageCollectionResponseSchema,
        response: await call({ path: "/v1/categories/usage" }),
      });
      record({
        operationId: "deleteCategory",
        method: "delete",
        path: "/v1/categories/{categoryId}",
        response: await call({
          method: "DELETE",
          path: `/v1/categories/${categoryId}`,
        }),
      });

      const cash = record({
        operationId: "createWallet",
        method: "post",
        path: "/v1/wallets",
        schema: walletResponseSchema,
        response: await openWallet(call, "Cash"),
      });
      const cashId = await readId(cash);
      const spareId = await readId(await openWallet(call, "Spare"));
      const scratchId = await readId(await openWallet(call, "Scratch"));

      record({
        operationId: "listWallets",
        method: "get",
        path: "/v1/wallets",
        schema: walletCollectionResponseSchema,
        response: await call({ path: `/v1/wallets?asOf=${ENTRY_DATE}` }),
      });
      record({
        operationId: "getWallet",
        method: "get",
        path: "/v1/wallets/{walletId}",
        schema: walletResponseSchema,
        response: await call({ path: `/v1/wallets/${cashId}` }),
      });
      record({
        operationId: "replaceWalletOpening",
        method: "put",
        path: "/v1/wallets/{walletId}/opening",
        schema: walletResponseSchema,
        response: await call({
          method: "PUT",
          path: `/v1/wallets/${cashId}/opening`,
          body: { amount: money("1500.00"), date: OPENING_DATE },
        }),
      });
      record({
        operationId: "changeWalletArchiveState",
        method: "patch",
        path: "/v1/wallets/{walletId}",
        schema: walletResponseSchema,
        response: await call({
          method: "PATCH",
          path: `/v1/wallets/${spareId}`,
          body: { archived: true },
        }),
      });
      record({
        operationId: "deleteWallet",
        method: "delete",
        path: "/v1/wallets/{walletId}",
        response: await call({
          method: "DELETE",
          path: `/v1/wallets/${scratchId}`,
        }),
      });

      const expense = record({
        operationId: "createTransaction",
        method: "post",
        path: "/v1/transactions",
        schema: transactionResponseSchema,
        response: await call({
          method: "POST",
          path: "/v1/transactions",
          idempotencyKey: "contract-expense",
          body: {
            type: "expense",
            amount: money("125.50"),
            walletId: cashId,
            categoryId: expenseCategory.id,
            transactionDate: ENTRY_DATE,
            note: "Contract expense",
          },
        }),
      });
      const expenseId = await readId(expense);

      record({
        operationId: "listTransactions",
        method: "get",
        path: "/v1/transactions",
        schema: transactionCollectionResponseSchema,
        response: await call({ path: "/v1/transactions?limit=10" }),
      });
      record({
        operationId: "getTransaction",
        method: "get",
        path: "/v1/transactions/{transactionId}",
        schema: transactionResponseSchema,
        response: await call({ path: `/v1/transactions/${expenseId}` }),
      });
      record({
        operationId: "updateTransaction",
        method: "put",
        path: "/v1/transactions/{transactionId}",
        schema: transactionResponseSchema,
        response: await call({
          method: "PUT",
          path: `/v1/transactions/${expenseId}`,
          body: {
            amount: money("130.25"),
            walletId: cashId,
            categoryId: expenseCategory.id,
            transactionDate: ENTRY_DATE,
            note: "Corrected",
          },
        }),
      });
      record({
        operationId: "getTransactionRefunds",
        method: "get",
        path: "/v1/transactions/{transactionId}/refunds",
        schema: transactionRefundsResponseSchema,
        response: await call({
          path: `/v1/transactions/${expenseId}/refunds`,
        }),
      });
      record({
        operationId: "getTransactionEntryDefaults",
        method: "get",
        path: "/v1/transactions/entry-defaults",
        schema: transactionEntryDefaultsResponseSchema,
        response: await call({ path: "/v1/transactions/entry-defaults" }),
      });
      record({
        operationId: "getMonthlyReport",
        method: "get",
        path: "/v1/reports/monthly",
        schema: monthlyReportResponseSchema,
        response: await call({
          path: `/v1/reports/monthly?month=${REPORT_MONTH}`,
        }),
      });
      record({
        operationId: "deleteTransaction",
        method: "delete",
        path: "/v1/transactions/{transactionId}",
        response: await call({
          method: "DELETE",
          path: `/v1/transactions/${expenseId}`,
        }),
      });

      for (const exchange of exchanges) {
        await expectDocumentedExchange(document, exchange);
      }
      expect(
        exchanges.map((exchange) => exchange.operationId).toSorted(),
      ).toEqual(publishedOperationIds(document).toSorted());
    });
  });

  test("every problem the API answers matches its documented variant", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      // A faulting route stands in for the opaque 500 every operation
      // documents; the boundary, not the route, owns that response.
      app.get("/health/fault", () => {
        throw new Error("contract fault");
      });
      const cookie = await signUp(app);
      const call = createClient(app, cookie);
      const document = await fetchDocument(app);
      const { exchanges, record } = createCollector();

      await call({ method: "POST", path: "/v1/categories/defaults" });
      const cashId = await readId(await openWallet(call, "Cash"));
      const { items: trees } = categoryCollectionResponseSchema.parse(
        await (await call({ path: "/v1/categories" })).json(),
      );
      const expenseCategory = trees.find(
        (category) => category.kind === "expense" && category.parentId !== null,
      );
      const protectedCategory = trees.find((category) => category.isProtected);
      if (expenseCategory === undefined || protectedCategory === undefined) {
        throw new Error("Expected a provisioned expense tree");
      }
      await call({
        method: "POST",
        path: "/v1/transactions",
        idempotencyKey: "problem-expense",
        body: {
          type: "expense",
          amount: money("10.00"),
          walletId: cashId,
          categoryId: expenseCategory.id,
          transactionDate: ENTRY_DATE,
          note: "",
        },
      });

      record({
        operationId: "listWallets",
        method: "get",
        path: "/v1/wallets",
        schema: problemDetailsSchema,
        response: await call({ path: "/v1/wallets", cookie: "" }),
      });
      record({
        operationId: "getWallet",
        method: "get",
        path: "/v1/wallets/{walletId}",
        schema: problemDetailsSchema,
        response: await call({
          path: "/v1/wallets/01999999-0000-7000-8000-000000000000",
        }),
      });
      record({
        operationId: "listTransactions",
        method: "get",
        path: "/v1/transactions",
        schema: problemDetailsSchema,
        response: await call({ path: "/v1/transactions?limit=none" }),
      });
      record({
        operationId: "createWallet",
        method: "post",
        path: "/v1/wallets",
        schema: problemDetailsSchema,
        response: await call({
          method: "POST",
          path: "/v1/wallets",
          body: {
            name: "Keyless",
            type: "cash",
            openingAmount: money("0.00"),
            openingDate: OPENING_DATE,
          },
        }),
      });
      record({
        operationId: "createWallet",
        method: "post",
        path: "/v1/wallets",
        schema: problemDetailsSchema,
        response: await call({
          method: "POST",
          path: "/v1/wallets",
          idempotencyKey: "wallet-Cash",
          body: {
            name: "Different",
            type: "cash",
            openingAmount: money("1000.00"),
            openingDate: OPENING_DATE,
          },
        }),
      });
      record({
        operationId: "createWallet",
        method: "post",
        path: "/v1/wallets",
        schema: problemDetailsSchema,
        response: await call({
          method: "POST",
          path: "/v1/wallets",
          idempotencyKey: "blank-name",
          body: {
            name: "   ",
            type: "cash",
            openingAmount: money("1000.00"),
            openingDate: OPENING_DATE,
          },
        }),
      });
      record({
        operationId: "deleteWallet",
        method: "delete",
        path: "/v1/wallets/{walletId}",
        schema: problemDetailsSchema,
        response: await call({
          method: "DELETE",
          path: `/v1/wallets/${cashId}`,
        }),
      });
      record({
        operationId: "getHealth",
        method: "get",
        path: "/health",
        schema: problemDetailsSchema,
        response: await call({ path: "/health/fault", cookie: "" }),
      });

      for (const exchange of exchanges) {
        await expectDocumentedExchange(document, exchange);
      }

      const answered = new Set<string>();
      for (const exchange of exchanges) {
        const problem = problemDetailsSchema.parse(
          await exchange.response.clone().json(),
        );
        expect(exchange.response.headers.get("content-type")).toContain(
          PROBLEM_MEDIA_TYPE,
        );
        expect(problem.type).toBe(`urn:bookkeeping:problem:${problem.code}`);
        answered.add(problem.code);
      }

      expect([...answered].toSorted()).toEqual(
        problemCodes
          .filter((code) => !UNANSWERED_PROBLEM_CODES.includes(code))
          .toSorted(),
      );
    });
  });

  test("a validation problem addresses each rejected field by JSON Pointer", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const cookie = await signUp(app);
      const call = createClient(app, cookie);

      const response = await call({
        method: "POST",
        path: "/v1/wallets",
        idempotencyKey: "field-errors",
        body: {
          name: "",
          type: "cash",
          openingAmount: money("0.00"),
          openingDate: "2999-01-01",
        },
      });
      const problem = problemDetailsSchema.parse(await response.json());

      expect(response.status).toBe(422);
      expect(problem.code).toBe("invalid-command");
      expect(problem.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pointer: "#/name" }),
          expect.objectContaining({ pointer: "#/openingDate" }),
        ]),
      );
      for (const error of problem.errors ?? []) {
        expect(error.pointer).toMatch(/^#\//);
      }
    });
  });
});
