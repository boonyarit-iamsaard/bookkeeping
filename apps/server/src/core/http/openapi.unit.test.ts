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

  it("documents the API's lasting design decisions", async () => {
    const document = await fetchDocument(createUnitTestApp());
    const operations = Object.values(document.paths).flatMap((methods) =>
      Object.entries(methods).flatMap(([method, operation]) =>
        operation === undefined ? [] : [{ method, operation }],
      ),
    );

    // A creation is retried safely by key and locates what it created.
    const creations = operations.filter(
      ({ operation }) => operation.responses["201"] !== undefined,
    );
    expect(creations.length).toBeGreaterThan(0);
    for (const { operation } of creations) {
      expect(operation.parameters).toContainEqual(
        expect.objectContaining({
          in: "header",
          name: "idempotency-key",
          required: true,
        }),
      );
      expect(operation.responses["201"].headers).toHaveProperty("Location");
    }

    // A deletion takes no body and answers without one.
    const deletions = operations.filter(({ method }) => method === "delete");
    expect(deletions.length).toBeGreaterThan(0);
    for (const { operation } of deletions) {
      expect(operation.requestBody).toBeUndefined();
      expect(operation.responses["204"]).toBeDefined();
      expect(operation.responses["204"]).not.toHaveProperty("content");
    }

    // Updates reject unknown members, and wallet state changes one at a time.
    for (const name of [
      "UpdateCategoryRequest",
      "WalletStateRequest",
      "UpdateTransactionRequest",
    ]) {
      expect(documentedSchema(document, name).additionalProperties).toBe(false);
    }
    expect(
      documentedSchema(document, "WalletStateRequest").required,
    ).toBeUndefined();

    // A transaction's type and refund link are fixed once it is recorded.
    const update = documentedSchema(document, "UpdateTransactionRequest");
    expect(update.properties).not.toHaveProperty("type");
    expect(update.properties).not.toHaveProperty("refundOfTransactionId");

    // Transfers and refunds never name their own category.
    const branches =
      documentedSchema(document, "CreateTransactionRequest").oneOf ?? [];
    for (const type of ["transfer", "refund"]) {
      const branch = branches.find(
        (candidate) => candidate.properties?.type?.const === type,
      );
      expect(branch?.additionalProperties).toBe(false);
      expect(branch?.properties).not.toHaveProperty("categoryId");
    }
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
