import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { describe, expect, test } from "vitest";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { freshDatabase, migrateDatabase } from "./migrate";
import { createTestUser } from "./testing/test-database";
import { testDatabaseUrl } from "./testing/url";

// Migrations can exceed Vitest's 5 s default on a loaded machine; matches the
// integration project's hookTimeout.
const migrationTestOptions = { timeout: 60_000 };

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

// `Pool.end()` resolves once its clients are asked to close, before their
// backends exit. A forced drop that terminates a backend still shutting down
// makes its client raise an error nothing listens for, so wait them out first.
async function waitForNoBackends(admin: Pool, name: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const result = await admin.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1",
      [name],
    );
    if (result.rows[0]?.count === 0 || Date.now() > deadline) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// Runs `use` against a migrated database of its own in the test container, so
// a reset that fails halfway cannot leave later test files without a schema.
async function withOwnDatabase(
  use: (url: string) => Promise<void>,
): Promise<void> {
  const sharedUrl = testDatabaseUrl();
  const name = `fresh_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(sharedUrl);
  url.pathname = `/${name}`;
  const admin = new Pool({ connectionString: sharedUrl });
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    let succeeded = false;
    try {
      await migrateDatabase(url.href);
      await use(url.href);
      succeeded = true;
    } finally {
      // A failed drop must not replace the error that failed the test.
      await waitForNoBackends(admin, name)
        .then(() => admin.query(`DROP DATABASE "${name}" WITH (FORCE)`))
        .catch((error: unknown) => {
          if (succeeded) {
            throw error;
          }
        });
    }
  } finally {
    await admin.end();
  }
}

describe("migrateDatabase", () => {
  test(
    "changes nothing when run again and leaves the schema usable",
    migrationTestOptions,
    async () => {
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
    },
  );
});

describe("freshDatabase", () => {
  test(
    "resets the schema and reapplies migrations",
    migrationTestOptions,
    async () => {
      await withOwnDatabase(async (url) => {
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
    },
  );
});
