import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "../auth/auth.schema";
import { createDatabase } from "../connection";
import { freshDatabase } from "../migrate";
import { createTestUser } from "./test-database";
import { testDatabaseUrl } from "./url";

describe("fresh database", () => {
  test("resets the schema and reapplies migrations", async () => {
    const url = testDatabaseUrl();
    const connection = createDatabase(url);
    let userId: string;
    try {
      const user = await createTestUser(connection.db);
      userId = user.id;
    } finally {
      await connection.close();
    }

    await freshDatabase(url);

    const resetConnection = createDatabase(url);
    try {
      const rows = await resetConnection.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId));
      expect(rows).toHaveLength(0);

      const newUser = await createTestUser(resetConnection.db);
      expect(newUser.id).not.toBe(userId);
    } finally {
      await resetConnection.close();
    }
  });

  test("refuses a non-local database before connecting", async () => {
    const url =
      "postgresql://postgres:password@postgres-production-1234.proxy.rlwy.net:5432/bookkeeping";

    await expect(freshDatabase(url)).rejects.toThrow(
      "postgres-production-1234.proxy.rlwy.net",
    );
  });
});
