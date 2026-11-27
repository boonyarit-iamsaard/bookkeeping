import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { demoAccountEmail } from "./demo-account";
import { freshDatabase, migrateDatabase } from "./migrate";
import { withEmptyDatabase } from "./testing/empty-database";
import {
  nextMigrationColumn,
  withNextMigrationFolder,
} from "./testing/next-migration";
import { createTestUser } from "./testing/test-database";
import { testDatabaseUrl } from "./testing/url";
import { hasWalletColumn, withLockedWallets } from "./testing/wallets-table";

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

// PostgreSQL's error code for a statement that gave up waiting on a lock.
const LOCK_NOT_AVAILABLE = "55P03";

describe("migrateDatabase with a lock timeout", () => {
  test(
    "gives up on a held lock within the timeout and applies nothing",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);
        const appliedBefore = await readAppliedMigrationHashes(url);

        await withLockedWallets(url, () =>
          withNextMigrationFolder(async (folder) => {
            const startedAt = Date.now();
            await expect(
              migrateDatabase(url, {
                migrationsFolder: folder,
                lockTimeoutMs: 1_000,
              }),
            ).rejects.toMatchObject({ cause: { code: LOCK_NOT_AVAILABLE } });
            expect(Date.now() - startedAt).toBeLessThan(5_000);
          }),
        );

        expect(await readAppliedMigrationHashes(url)).toEqual(appliedBefore);
        expect(await hasWalletColumn(url, nextMigrationColumn)).toBe(false);
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

        await freshDatabase(url, { allowOtherAccounts: true });

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

async function insertAccount(url: string, email: string): Promise<void> {
  const connection = createDatabase(url);
  try {
    await connection.db.insert(users).values({ name: "Someone", email });
  } finally {
    await connection.close();
  }
}

async function readAccountEmails(url: string): Promise<string[]> {
  const connection = createDatabase(url);
  try {
    const rows = await connection.db.select({ email: users.email }).from(users);
    return rows.map((row) => row.email);
  } finally {
    await connection.close();
  }
}

describe("freshDatabase with other Accounts", () => {
  test(
    "refuses a database holding another Account, names the override and drops nothing",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);
        await insertAccount(url, demoAccountEmail);
        await insertAccount(url, "owner@example.com");

        await expect(freshDatabase(url)).rejects.toThrow(
          "--allow-other-accounts",
        );

        expect((await readAccountEmails(url)).toSorted()).toEqual(
          [demoAccountEmail, "owner@example.com"].toSorted(),
        );
      });
    },
  );

  test(
    "resets that database when told to allow other Accounts",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);
        await insertAccount(url, "owner@example.com");

        await freshDatabase(url, { allowOtherAccounts: true });

        expect(await readAccountEmails(url)).toEqual([]);
      });
    },
  );

  test(
    "resets without the flag when the database is unmigrated, has no Accounts or only the demo Account",
    migrationTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await freshDatabase(url);
        expect(await readAccountEmails(url)).toEqual([]);

        await freshDatabase(url);

        await insertAccount(url, demoAccountEmail);
        await freshDatabase(url);
        expect(await readAccountEmails(url)).toEqual([]);
      });
    },
  );
});
