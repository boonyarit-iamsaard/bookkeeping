import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { describe, expect, test } from "vitest";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { freshDatabase, migrateDatabase } from "./migrate";
import { withEmptyDatabase } from "./testing/empty-database";
import {
  fixtureColumn,
  withSecondMigrationFolder,
} from "./testing/second-migration";
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

async function hasWalletColumn(url: string, column: string): Promise<boolean> {
  const connection = createDatabase(url);
  try {
    const result = await connection.db.execute(
      sql`SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'wallets'
            AND column_name = ${column}`,
    );
    return result.rows.length > 0;
  } finally {
    await connection.close();
  }
}

// PostgreSQL's error code for a statement that gave up waiting on a lock.
const LOCK_NOT_AVAILABLE = "55P03";

// Holds an exclusive lock on `wallets`, as a long query from the running app
// would, until the returned release runs.
async function lockWallets(url: string): Promise<() => Promise<void>> {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("BEGIN");
  await client.query("LOCK TABLE wallets IN ACCESS EXCLUSIVE MODE");
  return async () => {
    await client.query("ROLLBACK");
    await client.end();
  };
}

describe("migrateDatabase with a lock timeout", () => {
  test(
    "gives up on a held lock within the timeout and applies nothing",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);
        const appliedBefore = await readAppliedMigrationHashes(url);

        const release = await lockWallets(url);
        try {
          await withSecondMigrationFolder(async (folder) => {
            const startedAt = Date.now();
            await expect(
              migrateDatabase(url, {
                migrationsFolder: folder,
                lockTimeoutMs: 1_000,
              }),
            ).rejects.toMatchObject({ cause: { code: LOCK_NOT_AVAILABLE } });
            expect(Date.now() - startedAt).toBeLessThan(5_000);
          });
        } finally {
          await release();
        }

        expect(await readAppliedMigrationHashes(url)).toEqual(appliedBefore);
        expect(await hasWalletColumn(url, fixtureColumn)).toBe(false);
      });
    },
  );
});

describe("freshDatabase", () => {
  test(
    "resets the schema and reapplies migrations",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);
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
