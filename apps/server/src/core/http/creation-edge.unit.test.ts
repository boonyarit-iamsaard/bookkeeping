import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import * as z from "zod";
import { readIdempotencyKey } from "./idempotency.js";
import { PROBLEM_MEDIA_TYPE } from "./problem-details.js";
import { createCreationMiddleware } from "./request-validation.js";

const commandSchema = z.object({ name: z.string().trim().min(1) });

function app() {
  return new Hono().post(
    "/things",
    ...createCreationMiddleware(commandSchema),
    (c) =>
      c.json({
        key: readIdempotencyKey(c),
        name: c.req.valid("json").name,
      }),
  );
}

function post(headers: Record<string, string>, body: string) {
  return app().request("/things", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("createCreationMiddleware", () => {
  test("hands a handler the trimmed key and the validated command", async () => {
    const response = await post(
      { "idempotency-key": "  retry-1  " },
      JSON.stringify({ name: " Cash " }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ key: "retry-1", name: "Cash" });
  });

  test("answers the stable 400 for a missing, blank, or over-long key before reading the body", async () => {
    const unusable: Record<string, string>[] = [
      {},
      { "idempotency-key": "   " },
      { "idempotency-key": "k".repeat(256) },
    ];

    for (const headers of unusable) {
      // A body that is not even JSON proves the key is checked first.
      const response = await post(headers, "{");

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain(
        PROBLEM_MEDIA_TYPE,
      );
      expect(await response.json()).toMatchObject({
        code: "idempotency-key-required",
      });
    }
  });

  test("answers the 422 command problem for a usable key and a refused command", async () => {
    const response = await post(
      { "idempotency-key": "k1" },
      JSON.stringify({ name: "  " }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "invalid-command",
      errors: [{ pointer: "#/name" }],
    });
  });
});
