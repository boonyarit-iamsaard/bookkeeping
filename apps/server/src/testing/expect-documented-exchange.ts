import { expect } from "vitest";
import type * as z from "zod";
import type { OpenApiDocument } from "./openapi-document.js";
import { documentedOperation } from "./openapi-document.js";

/** One published operation answering one documented response. */
export interface ContractExchange {
  operationId: string;
  method: string;
  path: string;
  response: Response;
  /** The schema the document must name; a bodyless response names none. */
  schema?: z.ZodType;
}

/**
 * Asserts one exchange against the document that describes it: the operation
 * is published under the expected identifier, the status is documented, the
 * media type and schema reference match, and the actual body parses.
 */
export async function expectDocumentedExchange(
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
  expect(structuredClone(parsed.data)).toEqual(body);
}

export interface ExchangeCollector {
  exchanges: ContractExchange[];
  record: (exchange: ContractExchange) => Response;
}

/** Gathers the exchanges a contract test records, handing each response back. */
export function createCollector(): ExchangeCollector {
  const exchanges: ContractExchange[] = [];
  return {
    exchanges,
    record(exchange) {
      exchanges.push(exchange);
      return exchange.response;
    },
  };
}
