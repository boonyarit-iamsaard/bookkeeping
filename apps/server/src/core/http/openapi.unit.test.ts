import { Validator } from "@seriousme/openapi-schema-validator";
import { describe, expect, it } from "vitest";
import type * as z from "zod";
import { healthResponseSchema } from "../../features/health/health.routes.js";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";
import type {
  DocumentedOperation,
  DocumentedPaths,
} from "../../testing/openapi-document.js";
import {
  documentedOperation,
  documentedSchema,
  documentedSchemaRef,
  fetchDocument,
} from "../../testing/openapi-document.js";
import { OPENAPI_DOCUMENT_PATH } from "./openapi.js";
import { problemDetailsSchema } from "./problem-details.js";

function toOpenApiPath(honoPath: string): string {
  return honoPath.replaceAll(/:(\w+)/g, "{$1}");
}

function listUndocumentedRoutes(
  routes: readonly { method: string; path: string }[],
  paths: DocumentedPaths,
): string[] {
  const undocumented = new Set<string>();

  for (const route of routes) {
    if (route.method === "ALL" || route.path === OPENAPI_DOCUMENT_PATH) {
      continue;
    }

    const operation =
      paths[toOpenApiPath(route.path)]?.[route.method.toLowerCase()];
    if (operation === undefined) {
      undocumented.add(`${route.method} ${route.path}`);
    }
  }

  return [...undocumented];
}

interface DocumentedResponseExpectation {
  response: Response;
  operation: DocumentedOperation;
  schema: z.ZodType;
}

async function expectResponseToSatisfyDocumentation({
  response,
  operation,
  schema,
}: Readonly<DocumentedResponseExpectation>): Promise<void> {
  const documented = operation.responses[String(response.status)];
  expect(documented).toBeDefined();

  const [mediaType, media] = Object.entries(documented.content ?? {})[0];
  expect(response.headers.get("content-type")).toContain(mediaType);
  expect(media.schema.$ref).toBe(`#/components/schemas/${schema.meta()?.id}`);
  expect(schema.safeParse(await response.json()).success).toBe(true);
}

function expectProblemResponses(
  operation: Readonly<DocumentedOperation>,
  statuses: readonly string[],
) {
  for (const status of statuses) {
    expectProblemVariant(operation, { status, schemaId: "ProblemDetails" });
  }
}

interface ProblemVariantExpectation {
  status: string;
  schemaId: string;
}

/** A problem that carries its own extension members documents its own schema. */
function expectProblemVariant(
  operation: Readonly<DocumentedOperation>,
  { status, schemaId }: Readonly<ProblemVariantExpectation>,
) {
  expect(
    documentedSchemaRef(operation, {
      status,
      mediaType: "application/problem+json",
    }),
  ).toBe(`#/components/schemas/${schemaId}`);
}

describe("OpenAPI document", () => {
  it("serves a valid OpenAPI 3.1 document", async () => {
    const response = await createUnitTestApp().request(OPENAPI_DOCUMENT_PATH);
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(document.openapi).toBe("3.1.0");

    const validation = await new Validator().validate(document);
    expect(validation.errors).toBeUndefined();
    expect(validation.valid).toBe(true);
  });

  it("documents the health operation from its response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/health",
    });

    expect(operation.operationId).toBe("getHealth");
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/HealthResponse");
    expect(
      documentedSchemaRef(operation, {
        status: "500",
        mediaType: "application/problem+json",
      }),
    ).toBe("#/components/schemas/ProblemDetails");
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining(["HealthResponse", "ProblemDetails"]),
    );
  });

  it("documents the wallet reads from their response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const collection: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/wallets",
    });
    const resource: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/wallets/{walletId}",
    });

    expect(collection.operationId).toBe("listWallets");
    expect(
      documentedSchemaRef(collection, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/WalletCollection");
    expect(collection.responses["404"]).toBeUndefined();
    expectProblemResponses(collection, ["400", "401"]);
    // The as-of date is the collection's only parameter and is optional.
    expect(collection.parameters).toEqual([
      expect.objectContaining({ in: "query", name: "asOf" }),
    ]);
    expect(collection.parameters?.[0].required).toBeUndefined();
    expect(resource.operationId).toBe("getWallet");
    expect(
      documentedSchemaRef(resource, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Wallet");
    expectProblemResponses(resource, ["401", "404"]);
    expect(resource.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining([
        "Wallet",
        "WalletCollection",
        "Money",
        "Currency",
      ]),
    );
  });

  it("documents category reads from their response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/categories",
    });

    expect(operation.operationId).toBe("listCategories");
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/CategoryCollection");
    expect(operation.responses["401"]).toBeDefined();
    expect(operation.responses["404"]).toBeUndefined();
    const resource: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/categories/{categoryId}",
    });
    expect(resource.operationId).toBe("getCategory");
    expect(
      documentedSchemaRef(resource, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Category");
    expectProblemResponses(resource, ["401", "404"]);
    expect(resource.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(documentedSchema(document, "Category")).toBeDefined();
    expect(documentedSchema(document, "CategoryCollection")).toBeDefined();
  });

  it("documents category creation from its request and response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "post",
      path: "/v1/categories",
    });

    expect(operation.operationId).toBe("createCategory");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "header",
        name: "idempotency-key",
        required: true,
      }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/CreateCategoryRequest",
    );
    expect(
      documentedSchemaRef(operation, {
        status: "201",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Category");
    expect(operation.responses["201"].headers).toHaveProperty("Location");
    expectProblemResponses(operation, ["400", "401", "409", "422", "500"]);
    expect(documentedSchema(document, "CreateCategoryRequest")).toBeDefined();
  });

  it("documents the category update as a strict partial update", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "patch",
      path: "/v1/categories/{categoryId}",
    });

    expect(operation.operationId).toBe("updateCategory");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/UpdateCategoryRequest",
    );
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Category");
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(
      documentedSchema(document, "UpdateCategoryRequest").required,
    ).toEqual(["name", "iconId"]);
    expect(
      documentedSchema(document, "UpdateCategoryRequest").additionalProperties,
    ).toBe(false);
  });

  it("documents the category usage collection as a static read", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/categories/usage",
    });

    expect(operation.operationId).toBe("listCategoryUsage");
    expect(operation.parameters).toBeUndefined();
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/CategoryUsageCollection");
    expectProblemResponses(operation, ["401", "500"]);
    expect(operation.responses["404"]).toBeUndefined();
    expect(documentedSchema(document, "CategoryUsageEntry")).toEqual(
      expect.objectContaining({
        required: ["categoryId", "transactions"],
      }),
    );
  });

  it("documents the category usage read", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/categories/{categoryId}/usage",
    });

    expect(operation.operationId).toBe("getCategoryUsage");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/CategoryUsage");
    expectProblemResponses(operation, ["401", "404", "500"]);
    expect(documentedSchema(document, "CategoryUsage")).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          transactions: expect.objectContaining({ type: "integer" }),
          children: expect.objectContaining({ type: "integer" }),
        }),
      }),
    );
  });

  it("documents wallet creation from its request and response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "post",
      path: "/v1/wallets",
    });

    expect(operation.operationId).toBe("createWallet");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "header",
        name: "idempotency-key",
        required: true,
      }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/CreateWalletRequest",
    );
    expect(
      documentedSchemaRef(operation, {
        status: "201",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Wallet");
    expect(operation.responses["201"].headers).toHaveProperty("Location");
    expectProblemResponses(operation, ["400", "401", "409", "422", "500"]);
    expect(documentedSchema(document, "MoneyInput")).toEqual(
      expect.objectContaining({
        properties: expect.objectContaining({
          value: expect.objectContaining({
            type: "string",
            pattern: expect.any(String),
          }),
        }),
      }),
    );
    expect(
      documentedSchema(document, "CreateWalletRequest")?.properties
        ?.openingAmount,
    ).toHaveProperty("$ref", "#/components/schemas/MoneyInput");
  });

  it("documents the opening balance replacement as a subordinate resource", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "put",
      path: "/v1/wallets/{walletId}/opening",
    });

    expect(operation.operationId).toBe("replaceWalletOpening");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/WalletOpeningRequest",
    );
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Wallet");
    expect(operation.responses["201"]).toBeUndefined();
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(
      documentedSchema(document, "WalletOpeningRequest")?.properties?.amount,
    ).toHaveProperty("$ref", "#/components/schemas/MoneyInput");
    expect(documentedSchema(document, "WalletOpeningRequest").required).toEqual(
      ["amount", "date"],
    );
  });

  it("documents the archive-state change as a strict partial update", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "patch",
      path: "/v1/wallets/{walletId}",
    });

    expect(operation.operationId).toBe("changeWalletArchiveState");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/WalletArchiveStateRequest",
    );
    expect(
      documentedSchemaRef(operation, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Wallet");
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(
      documentedSchema(document, "WalletArchiveStateRequest").required,
    ).toEqual(["archived"]);
    expect(
      documentedSchema(document, "WalletArchiveStateRequest")
        .additionalProperties,
    ).toBe(false);
  });

  it("documents wallet deletion as a bodyless operation", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "delete",
      path: "/v1/wallets/{walletId}",
    });

    expect(operation.operationId).toBe("deleteWallet");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.responses["204"]).toEqual(
      expect.objectContaining({ description: "The wallet was deleted" }),
    );
    expect(operation.responses["204"]).not.toHaveProperty("content");
    expectProblemResponses(operation, ["401", "404"]);
    expectProblemVariant(operation, {
      status: "409",
      schemaId: "HistoryRemainsProblem",
    });
    expect(operation.responses["500"]).toBeDefined();
  });

  it("documents category deletion as a bodyless operation", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "delete",
      path: "/v1/categories/{categoryId}",
    });

    expect(operation.operationId).toBe("deleteCategory");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(operation.responses["204"]).toEqual(
      expect.objectContaining({ description: "The category was deleted" }),
    );
    expect(operation.responses["204"]).not.toHaveProperty("content");
    expectProblemResponses(operation, ["401", "404"]);
    expectProblemVariant(operation, {
      status: "409",
      schemaId: "CategoryRemovalProblem",
    });
    expect(operation.responses["500"]).toBeDefined();
  });

  it("documents transaction creation, update, listing, and reads", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const create: DocumentedOperation = documentedOperation(document, {
      method: "post",
      path: "/v1/transactions",
    });
    const collection: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/transactions",
    });
    const resource: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/transactions/{transactionId}",
    });
    const update: DocumentedOperation = documentedOperation(document, {
      method: "put",
      path: "/v1/transactions/{transactionId}",
    });
    const remove: DocumentedOperation = documentedOperation(document, {
      method: "delete",
      path: "/v1/transactions/{transactionId}",
    });
    const refunds: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/transactions/{transactionId}/refunds",
    });
    const defaults: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/transactions/entry-defaults",
    });

    expect(create.operationId).toBe("createTransaction");
    expect(create.requestBody?.required).toBe(true);
    expect(create.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/CreateTransactionRequest",
    );
    expect(create.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "header",
          name: "idempotency-key",
          required: true,
        }),
      ]),
    );
    expect(
      documentedSchemaRef(create, {
        status: "201",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Transaction");
    expect(create.responses["201"].headers).toHaveProperty("Location");
    expectProblemResponses(create, ["400", "401", "409", "422", "500"]);

    const requestSchema = documentedSchema(
      document,
      "CreateTransactionRequest",
    );
    expect(requestSchema.oneOf).toHaveLength(3);
    const branchWithType =
      (expected: string) =>
      (branch: Readonly<{ properties?: { type?: { const?: string } } }>) =>
        branch.properties?.type?.const === expected;
    const transferBranch = requestSchema.oneOf?.find(
      branchWithType("transfer"),
    );
    expect(transferBranch).toEqual(
      expect.objectContaining({
        additionalProperties: false,
        required: expect.arrayContaining([
          "type",
          "amount",
          "walletId",
          "destinationWalletId",
          "transactionDate",
          "note",
        ]),
        properties: expect.objectContaining({
          destinationWalletId: expect.any(Object),
        }),
      }),
    );
    expect(transferBranch?.required).not.toContain("categoryId");
    expect(transferBranch?.properties).not.toHaveProperty("categoryId");
    expect(transferBranch?.properties).not.toHaveProperty(
      "refundOfTransactionId",
    );
    const refundBranch = requestSchema.oneOf?.find(branchWithType("refund"));
    expect(refundBranch).toEqual(
      expect.objectContaining({
        additionalProperties: false,
        required: expect.arrayContaining([
          "type",
          "amount",
          "walletId",
          "refundOfTransactionId",
          "transactionDate",
          "note",
        ]),
        properties: expect.objectContaining({
          refundOfTransactionId: expect.any(Object),
        }),
      }),
    );
    expect(refundBranch?.required).not.toContain("categoryId");
    expect(refundBranch?.properties).not.toHaveProperty("categoryId");
    expect(refundBranch?.properties).not.toHaveProperty("destinationWalletId");
    expect(requestSchema.oneOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          required: expect.arrayContaining(["categoryId"]),
          properties: expect.objectContaining({
            categoryId: expect.any(Object),
          }),
        }),
      ]),
    );

    expect(collection.operationId).toBe("listTransactions");
    expect(
      documentedSchemaRef(collection, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/TransactionCollection");
    expectProblemResponses(collection, ["400", "401"]);
    expect(collection.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ in: "query", name: "from" }),
        expect.objectContaining({ in: "query", name: "to" }),
        expect.objectContaining({ in: "query", name: "walletId" }),
        expect.objectContaining({ in: "query", name: "categoryId" }),
        expect.objectContaining({ in: "query", name: "type" }),
        expect.objectContaining({ in: "query", name: "limit" }),
        expect.objectContaining({ in: "query", name: "cursor" }),
      ]),
    );

    expect(resource.operationId).toBe("getTransaction");
    expect(
      documentedSchemaRef(resource, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Transaction");
    expectProblemResponses(resource, ["401", "404"]);
    expect(resource.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "transactionId",
        required: true,
      }),
    ]);

    expect(update.operationId).toBe("updateTransaction");
    expect(update.requestBody?.required).toBe(true);
    expect(update.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/UpdateTransactionRequest",
    );
    expect(update.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "transactionId",
        required: true,
      }),
    ]);
    expect(
      documentedSchemaRef(update, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/Transaction");
    expectProblemResponses(update, ["400", "401", "404", "422", "500"]);
    const updateSchema = documentedSchema(document, "UpdateTransactionRequest");
    expect(updateSchema.additionalProperties).toBe(false);
    expect(updateSchema.required).toEqual([
      "amount",
      "walletId",
      "transactionDate",
      "note",
    ]);
    expect(updateSchema.properties).toEqual(
      expect.objectContaining({
        categoryId: expect.anything(),
        destinationWalletId: expect.anything(),
      }),
    );
    expect(updateSchema.properties?.amount).toHaveProperty(
      "$ref",
      "#/components/schemas/MoneyInput",
    );
    // The update request names no type or refund link: both stay fixed.
    expect(updateSchema.properties).not.toHaveProperty("type");
    expect(updateSchema.properties).not.toHaveProperty("refundOfTransactionId");

    expect(refunds.operationId).toBe("getTransactionRefunds");
    expect(
      documentedSchemaRef(refunds, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/TransactionRefunds");
    expectProblemResponses(refunds, ["401", "404"]);

    expect(remove.operationId).toBe("deleteTransaction");
    expect(remove.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "transactionId",
        required: true,
      }),
    ]);
    expect(remove.requestBody).toBeUndefined();
    expect(remove.responses["204"]).toEqual(
      expect.objectContaining({ description: "The transaction was deleted" }),
    );
    expect(remove.responses["204"]).not.toHaveProperty("content");
    expectProblemResponses(remove, ["401", "404"]);
    expectProblemVariant(remove, {
      status: "409",
      schemaId: "RefundsExistProblem",
    });

    expect(defaults.operationId).toBe("getTransactionEntryDefaults");
    expect(
      documentedSchemaRef(defaults, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/TransactionEntryDefaults");
    expectProblemResponses(defaults, ["401"]);
    expect(documentedSchema(document, "TransactionWallet")).toBeDefined();
  });

  it("documents the monthly report read", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const report: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/v1/reports/monthly",
    });

    expect(report.operationId).toBe("getMonthlyReport");
    expect(report.parameters).toEqual([
      expect.objectContaining({ in: "query", name: "month", required: true }),
    ]);
    expect(
      documentedSchemaRef(report, {
        status: "200",
        mediaType: "application/json",
      }),
    ).toBe("#/components/schemas/MonthlyReport");
    expectProblemResponses(report, ["400", "401"]);

    const reportSchema = documentedSchema(document, "MonthlyReport");
    expect(reportSchema.required).toEqual([
      "month",
      "income",
      "grossExpenses",
      "refunds",
      "netExpenses",
      "net",
      "transactionCount",
    ]);
    expect(reportSchema.properties?.income.$ref).toBe(
      "#/components/schemas/Money",
    );
  });

  it("documents every registered route", async () => {
    const app = createUnitTestApp();
    const document = await fetchDocument(app);

    expect(listUndocumentedRoutes(app.routes, document.paths)).toEqual([]);
  });

  it("returns health and fault responses that satisfy their documented schemas", async () => {
    const app = createUnitTestApp();
    app.get("/documented-fault", () => {
      throw new Error("unexpected");
    });
    const document = await fetchDocument(app);
    // Every operation documents the same opaque 500, so the health
    // operation stands in for any faulting route.
    const operation: DocumentedOperation = documentedOperation(document, {
      method: "get",
      path: "/health",
    });

    await expectResponseToSatisfyDocumentation({
      response: await app.request("/health"),
      operation,
      schema: healthResponseSchema,
    });
    await expectResponseToSatisfyDocumentation({
      response: await app.request("/documented-fault"),
      operation,
      schema: problemDetailsSchema,
    });
  });
});
