import { setupTestDatabase } from "@bookkeeping/database/testing";
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import type { AppEnv } from "../../core/http/request-context.js";
import {
  CATEGORIES_URL,
  createProvisionedOwner,
  findListedCategory,
} from "../../testing/category-route-fixture.js";
import { createIntegrationTestApp } from "../../testing/create-integration-test-app.js";
import { createTestAuthGateway } from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectProblem } from "../../testing/expect-problem.js";

const { withRollback } = setupTestDatabase();

interface DeleteCategoryRequest {
  categoryId: string;
  cookie?: string;
}

function deleteCategory(
  app: Readonly<Hono<AppEnv>>,
  { categoryId, cookie }: Readonly<DeleteCategoryRequest>,
) {
  return app.request(`${CATEGORIES_URL}/${categoryId}`, {
    method: "DELETE",
    headers: {
      origin: TEST_CLIENT_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
  });
}

describe("DELETE /v1/categories/{categoryId}", () => {
  test("removes an unused child with no response body and makes a repeat not found", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const groceries = await findListedCategory(app, {
        name: "Groceries",
        cookie,
      });

      const response = await deleteCategory(app, {
        categoryId: groceries.id,
        cookie,
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");
      await expectProblem(
        await deleteCategory(app, { categoryId: groceries.id, cookie }),
        { status: 404, code: "not-found" },
      );
    });
  });

  test("names the blocker for protected and for a parent with children", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie } = await createProvisionedOwner(db);
      const uncategorized = await findListedCategory(app, {
        name: "Uncategorized",
        cookie,
      });
      const foodAndDrink = await findListedCategory(app, {
        name: "Food & Drink",
        cookie,
      });

      await expectProblem(
        await deleteCategory(app, { categoryId: uncategorized.id, cookie }),
        { status: 409, code: "protected" },
      );
      await expectProblem(
        await deleteCategory(app, { categoryId: foodAndDrink.id, cookie }),
        { status: 409, code: "has-children" },
      );
    });
  });
});
