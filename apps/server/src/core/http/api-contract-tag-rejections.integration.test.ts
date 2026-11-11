import { setupTestDatabase } from "@bookkeeping/database/testing";
import { describe, test } from "vitest";
import { tagRejectionProblemSchema } from "../../features/tags/tag-rejection.js";
import {
  createIntegrationTestApp,
  signUpWithSession,
  TEST_API_ORIGIN,
} from "../../testing/create-integration-test-app.js";
import { TEST_CLIENT_ORIGIN } from "../../testing/create-unit-test-app.js";
import { expectDocumentedExchange } from "../../testing/expect-documented-exchange.js";
import { fetchDocument } from "../../testing/openapi-document.js";
import { IDEMPOTENCY_KEY_HEADER } from "./idempotency.js";

const { withRollback } = setupTestDatabase();

describe("published tag rejections", () => {
  test("a rejected create answers a body the documented field-error union accepts", async () => {
    await withRollback(async (db) => {
      const app = createIntegrationTestApp(db);
      const { cookie } = await signUpWithSession(app, "contract");
      const document = await fetchDocument(app, TEST_API_ORIGIN);

      const response = await app.request(`${TEST_API_ORIGIN}/v1/tags`, {
        method: "POST",
        headers: {
          origin: TEST_CLIENT_ORIGIN,
          cookie,
          [IDEMPOTENCY_KEY_HEADER]: "contract-tag-rejected",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: " " }),
      });

      await expectDocumentedExchange(document, {
        operationId: "createTag",
        method: "post",
        path: "/v1/tags",
        schema: tagRejectionProblemSchema,
        response,
      });
    });
  });
});
