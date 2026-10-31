import { execFile } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { describe, expect, test } from "vitest";
import { adoptBaseline } from "./adopt-baseline";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { migrateDatabase } from "./migrate";
import { withEmptyDatabase } from "./testing/empty-database";
import { createTestUser } from "./testing/test-database";

// Each adoption starts a throwaway PostgreSQL container and pushes a schema.
const adoptionTestOptions = { timeout: 180_000 };

const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
// drizzle-kit exports no path to its CLI, so run it from the package install.
const drizzleKit = join(packageDirectory, "node_modules/drizzle-kit/bin.cjs");

const secondMigrationFolder = fileURLToPath(
  new URL("testing/fixtures/second-migration", import.meta.url),
);

// Builds the schema the way production got it: one `drizzle-kit push` from
// the current tables, with no migrations table.
async function pushSchema(url: string): Promise<void> {
  await promisify(execFile)(process.execPath, [drizzleKit, "push", "--force"], {
    cwd: packageDirectory,
    env: { ...process.env, DATABASE_URL: url },
  });
}

async function runStatement(url: string, statement: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(statement);
  } finally {
    await pool.end();
  }
}

describe("adoptBaseline", () => {
  test(
    "adopts a pushed database, after which migrating applies nothing",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await pushSchema(url);

        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });

        await migrateDatabase(url);
        const connection = createDatabase(url);
        try {
          const user = await createTestUser(connection.db);
          const rows = await connection.db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, user.id));
          expect(rows).toHaveLength(1);
        } finally {
          await connection.close();
        }
      });
    },
  );

  test(
    "refuses a database that already has a migrations table",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await migrateDatabase(url);

        expect(await adoptBaseline({ url })).toEqual({
          status: "refused",
          reason: expect.stringContaining("drizzle.__drizzle_migrations"),
        });
      });
    },
  );

  test(
    "refuses a journal that holds more than the baseline",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await pushSchema(url);

        expect(
          await adoptBaseline({ url, migrationsFolder: secondMigrationFolder }),
        ).toEqual({
          status: "refused",
          reason: expect.stringContaining("0001_add_fixture_column"),
        });
        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });
      });
    },
  );

  test.each([
    {
      drift: "an extra index",
      object: "users_name_extra_idx",
      apply: "CREATE INDEX users_name_extra_idx ON users (name)",
      undo: "DROP INDEX users_name_extra_idx",
    },
    {
      drift: "a missing constraint",
      object: "transactions_note_length",
      apply:
        "ALTER TABLE transactions DROP CONSTRAINT transactions_note_length",
      undo: "ALTER TABLE transactions ADD CONSTRAINT transactions_note_length CHECK (char_length(note) <= 200)",
    },
  ])(
    "refuses $drift with the object in the diff, writing nothing",
    adoptionTestOptions,
    async ({ object, apply, undo }) => {
      await withEmptyDatabase(async (url) => {
        await pushSchema(url);
        await runStatement(url, apply);

        expect(await adoptBaseline({ url })).toEqual({
          status: "drifted",
          diff: expect.stringContaining(object),
        });

        await runStatement(url, undo);
        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });
      });
    },
  );

  test(
    "checks a matching database without writing anything",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await pushSchema(url);

        expect(await adoptBaseline({ url, check: true })).toEqual({
          status: "matches",
        });
        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });
      });
    },
  );
});
