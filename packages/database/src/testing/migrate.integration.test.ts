import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "../auth/auth.schema";
import { createDatabase } from "../connection";
import { migrateDatabase } from "../migrate";
import { createTestUser } from "./test-database";
import { testDatabaseUrl } from "./url";

describe("database migrations", () => {
  test("can be applied again and leave the schema usable", async () => {
    const url = testDatabaseUrl();

    await migrateDatabase(url);

    const connection = createDatabase(url);
    try {
      const user = await createTestUser(connection.db);
      const [storedUser] = await connection.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.id));

      expect(storedUser?.id).toBe(user.id);
    } finally {
      await connection.close();
    }
  });
});
