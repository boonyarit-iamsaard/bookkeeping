import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  CATEGORIES_URL,
  createProvisionedOwner,
  findListedCategory,
  listCategories,
} from "../../testing/category-route-fixture.js";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";
import {
  categoryCollectionResponseSchema,
  categoryResponseSchema,
} from "./category.routes.js";

const { withRollback } = setupTestDatabase();

const UPDATE_REQUEST = { name: "Beverages", iconId: "wine" };

interface UpdateCategoryRequest {
  categoryId: string;
  cookie?: string;
  body?: unknown;
  rawBody?: string;
}

function patchCategory(
  app: Hono<AppEnv>,
  {
    categoryId,
    cookie,
    body = UPDATE_REQUEST,
    rawBody,
  }: Readonly<UpdateCategoryRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

describe("PATCH /v1/categories/{categoryId}", () => {
  test("renames and re-icons in one save, leaving the tree position alone", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const response = await patchCategory(app, {
        categoryId: groceries.id,
        cookie,
        body: { name: "  Supermarket  ", iconId: "store" },
      });
      const updated = categoryResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(updated).toEqual({
        id: groceries.id,
        kind: "expense",
        parentId: groceries.parentId,
        name: "Supermarket",
        iconId: "store",
        isProtected: false,
      });
    });
  });

  test("lets Uncategorized change its icon but never its name", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const uncategorized = collection.items.find(
        (category) => category.kind === "expense" && category.isProtected,
      );
      if (!uncategorized) {
        throw new Error("Expected the protected expense category");
      }

      const renamed = await patchCategory(app, {
        categoryId: uncategorized.id,
        cookie,
        body: { name: "Misc", iconId: "sparkles" },
      });
      const problem = await expectProblem(renamed, {
        status: 422,
        code: "invalid-command",
      });
      expect(problem.errors).toEqual([
        { pointer: "#/name", code: "protected" },
      ]);
    });
  });

  test("maps duplicate, invalid, and unknown-field commands to field errors", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const duplicate = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: " restaurants ", iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(duplicate.errors).toEqual([
        { pointer: "#/name", code: "duplicate-name" },
      ]);

      const blank = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "   ", iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(blank.errors).toEqual([{ pointer: "#/name", code: "blank-name" }]);

      const unknownIcon = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "Groceries", iconId: "retired-glyph" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(unknownIcon.errors).toEqual([
        { pointer: "#/iconId", code: "unknown-icon" },
      ]);

      const tooLong = await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { name: "x".repeat(61), iconId: "cart" },
        }),
        { status: 422, code: "invalid-command" },
      );
      expect(tooLong.errors).toEqual([
        { pointer: "#/name", code: "name-too-long" },
      ]);

      await expectProblem(
        await patchCategory(app, {
          categoryId: groceries.id,
          cookie,
          body: { ...UPDATE_REQUEST, parentId: groceries.parentId },
        }),
        { status: 422, code: "invalid-command" },
      );
    });
  });

  test("rejects malformed JSON with the standard problem", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const collection = categoryCollectionResponseSchema.parse(
        await (await listCategories(app, cookie)).json(),
      );
      const anyCategory = collection.items[0];
      if (!anyCategory) {
        throw new Error("Expected the default categories");
      }

      await expectProblem(
        await patchCategory(app, {
          categoryId: anyCategory.id,
          cookie,
          rawBody: "{",
        }),
        { status: 400, code: "bad-request" },
      );
    });
  });
});
