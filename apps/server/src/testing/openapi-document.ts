import type { Hono } from "hono";
import { OPENAPI_DOCUMENT_PATH } from "../core/http/openapi.js";
import type { AppEnv } from "../core/http/request-context.js";

/** The slice of a generated OpenAPI document the contract tests read. */
export interface DocumentedMedia {
  schema: { $ref?: string };
}

export interface DocumentedOperation {
  operationId?: string;
  parameters?: { in: string; name: string; required?: boolean }[];
  requestBody?: {
    required?: boolean;
    content: { [mediaType: string]: DocumentedMedia };
  };
  responses: {
    [status: string]: {
      headers?: { [name: string]: unknown };
      content?: { [mediaType: string]: DocumentedMedia };
    };
  };
}

export interface DocumentedPaths {
  [path: string]: { [method: string]: DocumentedOperation | undefined };
}

/** The JSON Schema members the contract tests inspect on a component. */
export interface DocumentedSchema {
  $ref?: string;
  const?: string;
  required?: string[];
  additionalProperties?: boolean;
  properties?: { [name: string]: DocumentedSchema };
  oneOf?: DocumentedSchema[];
}

export interface OpenApiDocument {
  paths: DocumentedPaths;
  components: { schemas: { [name: string]: DocumentedSchema | undefined } };
}

/** Reads the document the app serves; `origin` prefixes the path for apps that route by absolute URL. */
export async function fetchDocument(
  app: Hono<AppEnv>,
  origin = "",
): Promise<OpenApiDocument> {
  return (await app.request(`${origin}${OPENAPI_DOCUMENT_PATH}`)).json();
}

interface OperationLocator {
  method: string;
  path: string;
}

/** The operation the document publishes at a lowercase method and OpenAPI path; absent is a failure. */
export function documentedOperation(
  document: Readonly<OpenApiDocument>,
  { method, path }: Readonly<OperationLocator>,
): DocumentedOperation {
  const operation = document.paths[path]?.[method];
  if (operation === undefined) {
    throw new Error(`Undocumented ${method} ${path}`);
  }
  return operation;
}

/** The component schema reference an operation documents for one status and media type. */
/** The component schema published under a name; absent is a failure. */
export function documentedSchema(
  document: Readonly<OpenApiDocument>,
  name: string,
): DocumentedSchema {
  const schema = document.components.schemas[name];
  if (schema === undefined) {
    throw new Error(`Undocumented component schema ${name}`);
  }
  return schema;
}

interface ResponseLocator {
  status: string;
  mediaType: string;
}

/** The component schema reference an operation documents for one status and media type. */
export function documentedSchemaRef(
  operation: Readonly<DocumentedOperation>,
  { status, mediaType }: Readonly<ResponseLocator>,
): string | undefined {
  return operation.responses[status]?.content?.[mediaType]?.schema.$ref;
}

export function publishedOperationIds(
  document: Readonly<OpenApiDocument>,
): string[] {
  return Object.values(document.paths)
    .flatMap((methods) => Object.values(methods))
    .flatMap((operation) =>
      operation?.operationId === undefined ? [] : [operation.operationId],
    );
}
