import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { GenerateSpecOptions, ResponsesWithResolver } from "hono-openapi";
import {
  ALLOWED_METHODS,
  describeRoute,
  openAPIRouteHandler,
  resolver,
} from "hono-openapi";
import {
  PROBLEM_MEDIA_TYPE,
  problemDetailsSchema,
  problemForStatus,
} from "./problem-details.js";
import type { ServerAppEnv } from "./request-context.js";

export const OPENAPI_DOCUMENT_PATH = "/openapi.json";

type DocumentedResponse = ResponsesWithResolver[string];

export function documentedProblemResponse(
  status: ContentfulStatusCode,
): DocumentedResponse {
  return {
    description: problemForStatus(status).title,
    content: {
      [PROBLEM_MEDIA_TYPE]: { schema: resolver(problemDetailsSchema) },
    },
  };
}

const openApiSpecOptions = {
  documentation: {
    info: {
      title: "Bookkeeping API",
      version: "0.1.0",
      description: "Personal finance HTTP API.",
    },
  },
  // Every operation can fail opaquely; the error boundary owns that response.
  // The library applies "ALL" defaults only to app.all() routes, so each
  // method carries the default explicitly.
  defaultOptions: Object.fromEntries(
    ALLOWED_METHODS.map((method) => [
      method,
      { responses: { 500: documentedProblemResponse(500) } },
    ]),
  ),
  // Validation failures use Problem Details, never the library's built-in
  // 400 body; routes document that response explicitly.
  defaultValidationErrorResponse: false,
} satisfies Partial<GenerateSpecOptions>;

export function mountOpenApiDocument(app: Hono<ServerAppEnv>): void {
  app.get(
    OPENAPI_DOCUMENT_PATH,
    describeRoute({ hide: true }),
    openAPIRouteHandler(app, openApiSpecOptions),
  );
}
