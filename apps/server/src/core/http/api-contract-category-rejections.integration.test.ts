import { initializeDefaultCategories } from "@bookkeeping/application/categories";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, test } from "vitest";
import { categoryRejectionProblemSchema } from "../../features/categories/category-rejection.js";
import {
  createIntegrationTestApp,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import {
  createOwnerSession,
  createTestAuthGateway,
} from "../../testing/create-test-auth-gateway.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectDocumentedExchange } from "../../testing/expect-documented-exchange.js";
import { fetchDocument } from "../../testing/openapi-document.js";
import { IDEMPOTENCY_KEY_HEADER } from "./idempotency.js";

const { withRollback } = setupTestDatabase();

describe("published category rejections", () => {
  test("a rejected create answers a body the documented field-error union accepts", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db, {
        auth: createTestAuthGateway(db),
      });
      const { cookie, ownerId } = await createOwnerSession(db);
      await initializeDefaultCategories(db, ownerId);
      const document = await fetchDocument(app, TEST_API_ORIGIN);

      const response = await app.request(`${TEST_API_ORIGIN}/v1/categories`, {
        method: "POST",
        headers: {
          origin: TEST_CLIENT_ORIGIN,
          cookie,
          [IDEMPOTENCY_KEY_HEADER]: "contract-category-rejected",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "expense",
          name: "Lunch",
          iconId: "utensils",
          parent: { create: { name: " ", iconId: "utensils" } },
        }),
      });

      await expectDocumentedExchange(document, {
        operationId: "createCategory",
        method: "post",
        path: "/v1/categories",
        schema: categoryRejectionProblemSchema,
        response,
      });
    });
  });
});
