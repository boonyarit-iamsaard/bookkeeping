import { readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { adoptBaseline } from "./adopt-baseline";
import { users } from "./auth/auth.schema";
import { createDatabase } from "./connection";
import { migrateDatabase } from "./migrate";
import { withEmptyDatabase } from "./testing/empty-database";
import { readMigrationJournal } from "./testing/next-migration";
import { createTestUser } from "./testing/test-database";

// Each adoption starts a throwaway PostgreSQL container to compare schemas.
const adoptionTestOptions = { timeout: 180_000 };

const committedMigrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);
let baselineMigrationsFolder: string;

function adoptBaselineFixture(url: string) {
  return adoptBaseline({ url, migrationsFolder: baselineMigrationsFolder });
}

const secondMigrationFolder = fileURLToPath(
  new URL("testing/fixtures/second-migration", import.meta.url),
);

// Recreates production's untracked baseline without following today's schema.
async function createUntrackedBaseline(url: string): Promise<void> {
  await runStatement(
    url,
    readFileSync(join(baselineMigrationsFolder, "0000_baseline.sql"), "utf8"),
  );
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

beforeAll(async () => {
  baselineMigrationsFolder = await mkdtemp(
    join(tmpdir(), "baseline-migration-"),
  );
  const journal = await readMigrationJournal(committedMigrationsFolder);
  journal.entries = journal.entries.filter(
    (entry) => entry.tag === "0000_baseline",
  );
  await mkdir(join(baselineMigrationsFolder, "meta"));
  await copyFile(
    join(committedMigrationsFolder, "0000_baseline.sql"),
    join(baselineMigrationsFolder, "0000_baseline.sql"),
  );
  await writeFile(
    join(baselineMigrationsFolder, "meta/_journal.json"),
    JSON.stringify(journal),
  );
});

afterAll(async () => {
  await rm(baselineMigrationsFolder, { recursive: true, force: true });
});

describe("adoptBaseline", () => {
  test(
    "writes the row Drizzle's migrator would, which migrating keeps alone",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await createUntrackedBaseline(url);

        expect(await adoptBaselineFixture(url)).toEqual({ status: "adopted" });

        const [baseline] = readMigrationFiles({
          migrationsFolder: baselineMigrationsFolder,
        });
        const adopted = {
          hash: baseline?.hash,
          createdAt: String(baseline?.folderMillis),
        };
        expect(await readMigrationRows(url)).toEqual([adopted]);
        await migrateDatabase(url, {
          migrationsFolder: baselineMigrationsFolder,
        });
        expect(await readMigrationRows(url)).toEqual([adopted]);
      });
    },
  );

  test(
    "adopts a pushed database, after which migrating applies nothing",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await createUntrackedBaseline(url);

        expect(await adoptBaselineFixture(url)).toEqual({ status: "adopted" });

        await migrateDatabase(url, {
          migrationsFolder: baselineMigrationsFolder,
        });
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
        await migrateDatabase(url, {
          migrationsFolder: baselineMigrationsFolder,
        });

        expect(await adoptBaselineFixture(url)).toEqual({
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
        await createUntrackedBaseline(url);

        expect(
          await adoptBaseline({ url, migrationsFolder: secondMigrationFolder }),
        ).toEqual({
          status: "refused",
          reason: expect.stringContaining("0001_add_fixture_column"),
        });
        expect(await hasDrizzleSchema(url)).toBe(false);
        expect(await adoptBaselineFixture(url)).toEqual({ status: "adopted" });
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
        await createUntrackedBaseline(url);
        await runStatement(url, apply);

        expect(await adoptBaselineFixture(url)).toEqual({
          status: "drifted",
          diff: expect.stringContaining(object),
        });
        expect(await hasDrizzleSchema(url)).toBe(false);

        await runStatement(url, undo);
        expect(await adoptBaselineFixture(url)).toEqual({ status: "adopted" });
      });
    },
  );

  test(
    "checks a matching database without writing anything",
    adoptionTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        await createUntrackedBaseline(url);

        expect(
          await adoptBaseline({
            url,
            check: true,
            migrationsFolder: baselineMigrationsFolder,
          }),
        ).toEqual({
          status: "matches",
        });
        expect(await hasDrizzleSchema(url)).toBe(false);
        expect(await adoptBaselineFixture(url)).toEqual({ status: "adopted" });
      });
    },
  );
});
