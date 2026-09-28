import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { freshDatabase, migrateDatabase } from "./migrate";
import { createTestUser } from "./testing/test-database";
import { testDatabaseUrl } from "./testing/url";

async function readAppliedMigrationHashes(url: string): Promise<string[]> {
  const connection = createDatabase(url);
  try {
    const result = await connection.db.execute<{ hash: string }>(
      sql`SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id`,
    );
    return result.rows.map((row) => row.hash);
  } finally {
    await connection.close();
  }
}

describe("migrateDatabase", () => {
  test("changes nothing when run again and leaves the schema usable", async () => {
    const url = testDatabaseUrl();
    const appliedBefore = await readAppliedMigrationHashes(url);

    await migrateDatabase(url);

    expect(appliedBefore).not.toHaveLength(0);
    expect(await readAppliedMigrationHashes(url)).toEqual(appliedBefore);

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

describe("freshDatabase", () => {
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
});
