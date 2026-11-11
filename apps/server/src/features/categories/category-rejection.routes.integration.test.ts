import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import type { Database } from "@bookkeeping/database/connection";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
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
import { categoryCollectionResponseSchema } from "./category.routes.js";
import { categoryRejectionProblemSchema } from "./category-rejection.js";

const { withRollback } = setupTestDatabase();

const CATEGORIES_URL = `${TEST_API_ORIGIN}/v1/categories`;
const NEW_PARENT = { name: "Drinks", iconId: "beer" };

async function setup(db: Database) {
  const app: Hono<AppEnv> = createIntegrationTestApp(db, {
    auth: createTestAuthGateway(db),
  });
  const { cookie, ownerId } = await createOwnerSession(db);
  await initializeDefaultCategories(db, ownerId);
  const listed = categoryCollectionResponseSchema.parse(
    await (
      await app.request(CATEGORIES_URL, {
        headers: { origin: TEST_CLIENT_ORIGIN, cookie },
      })
    ).json(),
  );
  function find(name: string) {
    const found = listed.items.find((item) => item.name === name);
    if (!found) {
      throw new Error(`Expected the ${name} category`);
    }
    return found;
  }
  return { app, cookie, find };
}

describe("category rejections", () => {
  test("a creation addresses each refused input at its own pointer, new-parent inputs included", async () => {
    await withRollback(async (db) => {
      const { app, cookie, find } = await setup(db);
      const base = {
        kind: "expense",
        name: "Lunch",
        iconId: "utensils",
        parent: null,
      };
      const rejections: [string, Record<string, unknown>, string, string][] = [
        ["blank-name", { name: " " }, "#/name", "blank-name"],
        ["overlong-name", { name: "x".repeat(61) }, "#/name", "name-too-long"],
        ["unknown-icon", { iconId: "nope" }, "#/iconId", "unknown-icon"],
        [
          "blank-parent-name",
          { parent: { create: { ...NEW_PARENT, name: " " } } },
          "#/parent/create/name",
          "blank-name",
        ],
        [
          "overlong-parent-name",
          { parent: { create: { ...NEW_PARENT, name: "x".repeat(61) } } },
          "#/parent/create/name",
          "name-too-long",
        ],
        [
          "unknown-parent-icon",
          { parent: { create: { ...NEW_PARENT, iconId: "nope" } } },
          "#/parent/create/iconId",
          "unknown-icon",
        ],
        [
          "duplicate-parent-name",
          { parent: { create: { ...NEW_PARENT, name: " food & drink " } } },
          "#/parent/create/name",
          "duplicate-name",
        ],
        [
          "child-as-parent",
          { parent: { existingId: find("Groceries").id } },
          "#/parent",
          "parent-is-child",
        ],
      ];

      for (const [idempotencyKey, change, pointer, code] of rejections) {
        const problem = await expectProblem(
          await app.request(CATEGORIES_URL, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: TEST_CLIENT_ORIGIN,
              cookie,
              "idempotency-key": idempotencyKey,
            },
            body: JSON.stringify({ ...base, ...change }),
          }),
          { status: 422, code: "invalid-command" },
        );
        expect(problem.errors).toEqual([{ pointer, code }]);
        expect(categoryRejectionProblemSchema.safeParse(problem).success).toBe(
          true,
        );
      }
    });
  });

  test("an update addresses Uncategorized's fixed name at the name", async () => {
    await withRollback(async (db) => {
      const { app, cookie, find } = await setup(db);

      const problem = await expectProblem(
        await app.request(`${CATEGORIES_URL}/${find("Uncategorized").id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            origin: TEST_CLIENT_ORIGIN,
            cookie,
          },
          body: JSON.stringify({ name: "Misc", iconId: "sparkles" }),
        }),
        { status: 422, code: "invalid-command" },
      );

      expect(problem.errors).toEqual([
        { pointer: "#/name", code: "protected" },
      ]);
      expect(categoryRejectionProblemSchema.safeParse(problem).success).toBe(
        true,
      );
    });
  });
});
