import * as z from "zod";
import {
  tagCollectionResponseSchema,
  tagResponseSchema,
} from "../../features/tags/tag.routes.js";
import type { ContractExchange } from "../../testing/expect-documented-exchange.js";

interface TagRequest {
  method?: string;
  path: string;
  idempotencyKey?: string;
  body?: unknown;
}

interface TagExchangesOptions {
  call: (request: TagRequest) => Promise<Response>;
  record: (exchange: ContractExchange) => Response;
}

/** Records one exchange per tag operation for the contract test, ending with the tag deleted. */
export async function recordTagExchanges({
  call,
  record,
}: Readonly<TagExchangesOptions>): Promise<void> {
  const created = record({
    operationId: "createTag",
    method: "post",
    path: "/v1/tags",
    schema: tagResponseSchema,
    response: await call({
      method: "POST",
      path: "/v1/tags",
      idempotencyKey: "contract-tag",
      body: { name: "Coffee" },
    }),
  });
  const { id } = z.object({ id: z.uuid() }).parse(await created.clone().json());
  record({
    operationId: "listTags",
    method: "get",
    path: "/v1/tags",
    schema: tagCollectionResponseSchema,
    response: await call({ path: "/v1/tags" }),
  });
  record({
    operationId: "updateTag",
    method: "patch",
    path: "/v1/tags/{tagId}",
    schema: tagResponseSchema,
    response: await call({
      method: "PATCH",
      path: `/v1/tags/${id}`,
      body: { name: "Café" },
    }),
  });
  record({
    operationId: "deleteTag",
    method: "delete",
    path: "/v1/tags/{tagId}",
    response: await call({ method: "DELETE", path: `/v1/tags/${id}` }),
  });
}
