import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { problemDetailsSchema } from "../../core/http/problem-details.js";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  tagCollectionResponseSchema,
  tagResponseSchema,
} from "./tag.routes.js";
import { tagRejectionProblemSchema } from "./tag-rejection.js";

const { withRollback } = setupTestDatabase();

const TAGS_URL = `${TEST_API_ORIGIN}/v1/tags`;

interface TagRequest {
  method?: string;
  path?: string;
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
}

function request(
  app: Readonly<Hono<AppEnv>>,
  {
    method = "GET",
    path = "",
    cookie,
    idempotencyKey,
    body,
  }: Readonly<TagRequest>,
) {
  return app.request(`${TAGS_URL}${path}`, {
    method,
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

interface CreateTagRequest {
  cookie: string;
  name: string;
}

async function createTag(
  app: Readonly<Hono<AppEnv>>,
  { cookie, name }: Readonly<CreateTagRequest>,
) {
  const response = await request(app, {
    method: "POST",
    cookie,
    idempotencyKey: `tag-${name}`,
    body: { name },
  });
  expect(response.status).toBe(201);
  return tagResponseSchema.parse(await response.json());
}

function createApp(db: Parameters<typeof createIntegrationTestApp>[0]) {
  return createIntegrationTestApp(db, { auth: createTestAuthGateway(db) });
}

describe("tag routes", () => {
  test("creates a tag at its own location and lists it for its owner only", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const owner = await createOwnerSession(db);
      const stranger = await createOwnerSession(db);

      const response = await request(app, {
        method: "POST",
        cookie: owner.cookie,
        idempotencyKey: "tag-coffee",
        body: { name: " Coffee " },
      });

      expect(response.status).toBe(201);
      const tag = tagResponseSchema.parse(await response.json());
      expect(tag.name).toBe("Coffee");
      expect(response.headers.get("location")).toBe(`/v1/tags/${tag.id}`);
      const listed = tagCollectionResponseSchema.parse(
        await (await request(app, { cookie: owner.cookie })).json(),
      );
      expect(listed).toEqual({
        items: [
          { id: tag.id, name: "Coffee", transactionCount: 0, lastUsedAt: null },
        ],
        page: { nextCursor: null },
      });
      const foreign = tagCollectionResponseSchema.parse(
        await (await request(app, { cookie: stranger.cookie })).json(),
      );
      expect(foreign.items).toEqual([]);
    });
  });

  test("replays the original creation for a retried key and conflicts on a changed payload", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const { cookie } = await createOwnerSession(db);
      const first = await request(app, {
        method: "POST",
        cookie,
        idempotencyKey: "tag-retry",
        body: { name: "Coffee" },
      });
      const original = tagResponseSchema.parse(await first.json());

      const retry = await request(app, {
        method: "POST",
        cookie,
        idempotencyKey: "tag-retry",
        // The same name spelled with stray spaces is the same normalized payload.
        body: { name: " Coffee " },
      });
      const conflict = await request(app, {
        method: "POST",
        cookie,
        idempotencyKey: "tag-retry",
        body: { name: "Tea" },
      });

      expect(retry.status).toBe(201);
      expect(retry.headers.get("location")).toBe(first.headers.get("location"));
      expect(tagResponseSchema.parse(await retry.json())).toEqual(original);
      await expectProblem(conflict, {
        status: 409,
        code: "idempotency-conflict",
      });
      const listed = tagCollectionResponseSchema.parse(
        await (await request(app, { cookie })).json(),
      );
      expect(listed.items).toHaveLength(1);
    });
  });

  test("a missing, blank, or over-long Idempotency-Key is a bad request", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const { cookie } = await createOwnerSession(db);

      for (const idempotencyKey of [undefined, "   ", "k".repeat(256)]) {
        await expectProblem(
          await request(app, {
            method: "POST",
            cookie,
            idempotencyKey,
            body: { name: "Coffee" },
          }),
          { status: 400, code: "idempotency-key-required" },
        );
      }
    });
  });

  test("maps a refused name to its field", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const { cookie } = await createOwnerSession(db);
      const coffee = await createTag(app, { cookie, name: "Coffee" });

      const duplicate = await request(app, {
        method: "POST",
        cookie,
        idempotencyKey: "tag-duplicate",
        body: { name: "coffee" },
      });
      const blank = await request(app, {
        method: "PATCH",
        path: `/${coffee.id}`,
        cookie,
        body: { name: " " },
      });
      const overlong = await request(app, {
        method: "POST",
        cookie,
        idempotencyKey: "tag-overlong",
        body: { name: "x".repeat(41) },
      });

      for (const [response, code] of [
        [duplicate, "duplicate-name"],
        [blank, "blank-name"],
        [overlong, "name-too-long"],
      ] as const) {
        const problem = await expectProblem(response, {
          status: 422,
          code: "invalid-command",
        });
        expect(problem.errors).toEqual([{ pointer: "#/name", code }]);
        expect(tagRejectionProblemSchema.safeParse(problem).success).toBe(true);
      }
    });
  });

  test("renames a tag, and answers the surviving tag when the rename merges", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const { cookie } = await createOwnerSession(db);
      const drifted = await createTag(app, { cookie, name: "7-11" });
      const kept = await createTag(app, { cookie, name: "7-Eleven" });

      const renamed = await request(app, {
        method: "PATCH",
        path: `/${drifted.id}`,
        cookie,
        body: { name: "Seven" },
      });
      const merged = await request(app, {
        method: "PATCH",
        path: `/${drifted.id}`,
        cookie,
        body: { name: "7-eleven" },
      });

      expect(renamed.status).toBe(200);
      expect(tagResponseSchema.parse(await renamed.json())).toEqual({
        id: drifted.id,
        name: "Seven",
      });
      expect(merged.status).toBe(200);
      expect(tagResponseSchema.parse(await merged.json())).toEqual({
        id: kept.id,
        name: "7-eleven",
      });
    });
  });

  test("deletes a tag, after which it is not found", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);
      const { cookie } = await createOwnerSession(db);
      const coffee = await createTag(app, { cookie, name: "Coffee" });

      const deleted = await request(app, {
        method: "DELETE",
        path: `/${coffee.id}`,
        cookie,
      });

      expect(deleted.status).toBe(204);
      await expectProblem(
        await request(app, { method: "DELETE", path: `/${coffee.id}`, cookie }),
        { status: 404, code: "not-found" },
      );
    });
  });

  test("requires a session", async () => {
    await withRollback(async (db) => {
      const app = createApp(db);

      const response = await request(app, {});

      expect(response.status).toBe(401);
      expect(problemDetailsSchema.parse(await response.json()).code).toBe(
        "unauthenticated",
      );
    });
  });
});
