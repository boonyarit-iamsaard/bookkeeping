import { Validator } from "@seriousme/openapi-schema-validator";
import type { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type * as z from "zod";
import { healthResponseSchema } from "../../features/health/health.routes.js";
import { createUnitTestApp } from "../../testing/create-unit-test-app.js";
import { OPENAPI_DOCUMENT_PATH } from "./openapi.js";
import { problemDetailsSchema } from "./problem-details.js";
import type { AppEnv } from "./request-context.js";

interface DocumentedMedia {
  schema: { $ref?: string };
}

interface DocumentedOperation {
  operationId?: string;
  parameters?: { in: string; name: string; required?: boolean }[];
  requestBody?: {
    required?: boolean;
    content: { [mediaType: string]: DocumentedMedia };
  };
  responses: {
    [status: string]: {
      headers?: { [name: string]: unknown };
      content: { [mediaType: string]: DocumentedMedia };
    };
  };
}

interface DocumentedPaths {
  [path: string]: { [method: string]: DocumentedOperation | undefined };
}

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

  const [mediaType, media] = Object.entries(documented.content)[0];
  expect(response.headers.get("content-type")).toContain(mediaType);
  expect(media.schema.$ref).toBe(`#/components/schemas/${schema.meta()?.id}`);
  expect(schema.safeParse(await response.json()).success).toBe(true);
}

function expectProblemResponses(
  operation: Readonly<DocumentedOperation>,
  statuses: readonly string[],
) {
  for (const status of statuses) {
    expect(
      operation.responses[status].content["application/problem+json"].schema
        .$ref,
    ).toBe("#/components/schemas/ProblemDetails");
  }
}

async function fetchDocument(app: Hono<AppEnv>) {
  return (await app.request(OPENAPI_DOCUMENT_PATH)).json();
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
    const operation: DocumentedOperation = document.paths["/health"].get;

    expect(operation.operationId).toBe("getHealth");
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/HealthResponse");
    expect(
      operation.responses["500"].content["application/problem+json"].schema
        .$ref,
    ).toBe("#/components/schemas/ProblemDetails");
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining(["HealthResponse", "ProblemDetails"]),
    );
  });

  it("documents the wallet reads from their response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const collection: DocumentedOperation = document.paths["/v1/wallets"].get;
    const resource: DocumentedOperation =
      document.paths["/v1/wallets/{walletId}"].get;

    expect(collection.operationId).toBe("listWallets");
    expect(
      collection.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/WalletCollection");
    expect(collection.responses["404"]).toBeUndefined();
    expect(resource.operationId).toBe("getWallet");
    expect(
      resource.responses["200"].content["application/json"].schema.$ref,
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
    const operation: DocumentedOperation = document.paths["/v1/categories"].get;

    expect(operation.operationId).toBe("listCategories");
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/CategoryCollection");
    expect(operation.responses["401"]).toBeDefined();
    expect(operation.responses["404"]).toBeUndefined();
    const resource: DocumentedOperation =
      document.paths["/v1/categories/{categoryId}"].get;
    expect(resource.operationId).toBe("getCategory");
    expect(
      resource.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Category");
    expectProblemResponses(resource, ["401", "404"]);
    expect(resource.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(document.components.schemas.Category).toBeDefined();
    expect(document.components.schemas.CategoryCollection).toBeDefined();
  });

  it("documents category creation from its request and response schemas", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/categories"].post;

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
      operation.responses["201"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Category");
    expect(operation.responses["201"].headers).toHaveProperty("Location");
    expectProblemResponses(operation, ["400", "401", "409", "422", "500"]);
    expect(document.components.schemas.CreateCategoryRequest).toBeDefined();
  });

  it("documents the category update as a strict partial update", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/categories/{categoryId}"].patch;

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
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Category");
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(document.components.schemas.UpdateCategoryRequest.required).toEqual([
      "name",
      "iconId",
    ]);
    expect(
      document.components.schemas.UpdateCategoryRequest.additionalProperties,
    ).toBe(false);
  });

  it("documents the category usage read", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/categories/{categoryId}/usage"].get;

    expect(operation.operationId).toBe("getCategoryUsage");
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        in: "path",
        name: "categoryId",
        required: true,
      }),
    ]);
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/CategoryUsage");
    expectProblemResponses(operation, ["401", "404", "500"]);
    expect(document.components.schemas.CategoryUsage).toEqual(
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
    const operation: DocumentedOperation = document.paths["/v1/wallets"].post;

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
      operation.responses["201"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Wallet");
    expect(operation.responses["201"].headers).toHaveProperty("Location");
    expectProblemResponses(operation, ["400", "401", "409", "422", "500"]);
    expect(document.components.schemas.MoneyInput).toEqual(
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
      document.components.schemas.CreateWalletRequest.properties.openingAmount,
    ).toHaveProperty("$ref", "#/components/schemas/MoneyInput");
  });

  it("documents the opening balance replacement as a subordinate resource", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/wallets/{walletId}/opening"].put;

    expect(operation.operationId).toBe("replaceWalletOpening");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/WalletOpeningRequest",
    );
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Wallet");
    expect(operation.responses["201"]).toBeUndefined();
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(
      document.components.schemas.WalletOpeningRequest.properties.amount,
    ).toHaveProperty("$ref", "#/components/schemas/MoneyInput");
    expect(document.components.schemas.WalletOpeningRequest.required).toEqual([
      "amount",
      "date",
    ]);
  });

  it("documents the archive-state change as a strict partial update", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/wallets/{walletId}"].patch;

    expect(operation.operationId).toBe("changeWalletArchiveState");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.requestBody?.required).toBe(true);
    expect(operation.requestBody?.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/WalletArchiveStateRequest",
    );
    expect(
      operation.responses["200"].content["application/json"].schema.$ref,
    ).toBe("#/components/schemas/Wallet");
    expectProblemResponses(operation, ["400", "401", "404", "422", "500"]);
    expect(
      document.components.schemas.WalletArchiveStateRequest.required,
    ).toEqual(["archived"]);
    expect(
      document.components.schemas.WalletArchiveStateRequest
        .additionalProperties,
    ).toBe(false);
  });

  it("documents wallet deletion as a bodyless operation", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/wallets/{walletId}"].delete;

    expect(operation.operationId).toBe("deleteWallet");
    expect(operation.parameters).toEqual([
      expect.objectContaining({ in: "path", name: "walletId", required: true }),
    ]);
    expect(operation.responses["204"]).toEqual(
      expect.objectContaining({ description: "The wallet was deleted" }),
    );
    expect(operation.responses["204"]).not.toHaveProperty("content");
    expectProblemResponses(operation, ["401", "404", "409"]);
    expect(operation.responses["500"]).toBeDefined();
  });

  it("documents category deletion as a bodyless operation", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operation: DocumentedOperation =
      document.paths["/v1/categories/{categoryId}"].delete;

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
    expectProblemResponses(operation, ["401", "404", "409"]);
    expect(operation.responses["500"]).toBeDefined();
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
    const operation: DocumentedOperation = document.paths["/health"].get;

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
