import { Validator } from "@seriousme/openapi-schema-validator";
import type { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type * as z from "zod";
import { healthResponseSchema } from "../../features/health/health.routes.js";
import { createApp } from "../app.js";
import { OPENAPI_DOCUMENT_PATH } from "./openapi.js";
import { problemDetailsSchema } from "./problem-details.js";
import type { AppEnv } from "./request-context.js";

interface DocumentedMedia {
  schema: { $ref?: string };
}

interface DocumentedOperation {
  operationId?: string;
  responses: {
    [status: string]: { content: { [mediaType: string]: DocumentedMedia } };
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

async function fetchDocument(app: Hono<AppEnv>) {
  return (await app.request(OPENAPI_DOCUMENT_PATH)).json();
}

describe("OpenAPI document", () => {
  it("serves a valid OpenAPI 3.1 document", async () => {
    const response = await createApp().request(OPENAPI_DOCUMENT_PATH);
    const document = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(document.openapi).toBe("3.1.0");

    const validation = await new Validator().validate(document);
    expect(validation.errors).toBeUndefined();
    expect(validation.valid).toBe(true);
  });

  it("documents the health operation from its response schemas", async () => {
    const document = await fetchDocument(createApp());
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

  it("documents every registered route", async () => {
    const app = createApp();
    const document = await fetchDocument(app);

    expect(listUndocumentedRoutes(app.routes, document.paths)).toEqual([]);
  });

  it("returns health and fault responses that satisfy their documented schemas", async () => {
    const app = createApp();
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
