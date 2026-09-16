import { users } from "@bookkeeping/database/auth";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createAuth } from "./config";

const { withRollback } = setupTestDatabase();

const TEST_SECRET = "integration-test-secret-with-at-least-32-chars";
const TEST_BASE_URL = "http://localhost:4000";

describe("createAuth", () => {
  test("a failed multi-write adapter flow leaves no partial rows behind", async () => {
    await withRollback(async (db) => {
      const auth = createAuth({
        db,
        secret: TEST_SECRET,
        baseURL: TEST_BASE_URL,
      });
      const { adapter } = await auth.$context;
      const email = `rollback-${process.pid}-${Date.now()}@test.local`;

      await expect(
        adapter.transaction(async (trx) => {
          await trx.create({
            model: "user",
            data: { name: "Rolled back", email, emailVerified: false },
          });
          throw new Error("second write failed");
        }),
      ).rejects.toThrow("second write failed");

      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      expect(rows).toEqual([]);
    });
  });
});
