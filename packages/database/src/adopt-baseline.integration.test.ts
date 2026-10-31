import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { describe, expect, test } from "vitest";
import * as z from "zod";
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

const committedMigrationsFolder = join(packageDirectory, "drizzle");

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

interface MigrationRow {
  hash: string;
  createdAt: string;
}

async function readMigrationRows(url: string): Promise<MigrationRow[]> {
  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query<MigrationRow>(
      'SELECT hash, created_at::text AS "createdAt" FROM drizzle.__drizzle_migrations ORDER BY id',
    );
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function hasDrizzleSchema(url: string): Promise<boolean> {
  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query<{ schema: string | null }>(
      "SELECT to_regnamespace('drizzle')::text AS schema",
    );
    return result.rows[0]?.schema != null;
  } finally {
    await pool.end();
  }
}

const journalSchema = z.object({
  entries: z.tuple([z.object({ when: z.number() })]),
});

function readBaselineWhen(): number {
  const journal = journalSchema.parse(
    JSON.parse(
      readFileSync(
        join(committedMigrationsFolder, "meta/_journal.json"),
        "utf8",
      ),
    ),
  );
  return journal.entries[0].when;
}

describe("adoptBaseline", () => {
  test(
    "writes the row Drizzle's migrator would, which migrating keeps alone",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await pushSchema(url);

        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });

        const [baseline] = readMigrationFiles({
          migrationsFolder: committedMigrationsFolder,
        });
        const adopted = {
          hash: baseline?.hash,
          createdAt: String(readBaselineWhen()),
        };
        expect(await readMigrationRows(url)).toEqual([adopted]);
        await migrateDatabase(url);
        expect(await readMigrationRows(url)).toEqual([adopted]);
      });
    },
  );

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
        expect(await hasDrizzleSchema(url)).toBe(false);

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
        expect(await hasDrizzleSchema(url)).toBe(false);
        expect(await adoptBaseline({ url })).toEqual({ status: "adopted" });
      });
    },
  );
});
