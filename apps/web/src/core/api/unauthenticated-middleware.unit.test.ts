import createClient from "openapi-fetch";
import { describe, expect, test, vi } from "vitest";
import type { paths } from "@/core/api/openapi.gen";
import { createUnauthenticatedMiddleware } from "@/core/api/unauthenticated-middleware";

function createClientAnswering(status: number) {
  const onUnauthenticated = vi.fn();
  const client = createClient<paths>({
    baseUrl: "http://api.test",
    fetch: async () =>
      new Response(status === 200 ? "[]" : null, {
        status,
        headers: { "content-type": "application/json" },
      }),
  });
  client.use(createUnauthenticatedMiddleware({ onUnauthenticated }));
  return { client, onUnauthenticated };
}

describe("createUnauthenticatedMiddleware", () => {
  test("reports a 401 and still hands the response to the caller", async () => {
    const { client, onUnauthenticated } = createClientAnswering(401);

    const { response } = await client.GET("/v1/wallets");

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);
  });

  test("ignores every other status, including a 403", async () => {
    for (const status of [200, 403, 500]) {
      const { client, onUnauthenticated } = createClientAnswering(status);

      await client.GET("/v1/wallets");

      expect(onUnauthenticated).not.toHaveBeenCalled();
    }
  });
});
