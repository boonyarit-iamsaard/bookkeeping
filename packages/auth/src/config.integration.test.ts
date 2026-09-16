import { users } from "@bookkeeping/database/auth";
import { setupTestDatabase } from "@bookkeeping/database/testing";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createTestAuth, uniqueTestEmail } from "./testing/test-auth";

const { withRollback } = setupTestDatabase();

describe("createAuth", () => {
  test("a failed multi-write adapter flow leaves no partial rows behind", async () => {
    await withRollback(async (db) => {
      const auth = createTestAuth(db);
      const { adapter } = await auth.$context;
      const email = uniqueTestEmail("rollback");

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
