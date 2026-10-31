import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import * as z from "zod";
import { diffAgainstBaseline } from "./baseline-schema";
import { migrationsFolder } from "./migrate";

const BASELINE_TAG = "0000_baseline";

const journalSchema = z.object({
  entries: z.array(z.object({ tag: z.string() })),
});

function readJournalTags(folder: string): string[] {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")),
  );
  return journal.entries.map((entry) => entry.tag);
}

export interface AdoptBaselineOptions {
  url: string;
  /** Compares the schemas and stops before writing anything. */
  check?: boolean;
  /** Overrides the committed migrations, for tests. */
  migrationsFolder?: string;
}

export type AdoptBaselineResult =
  | { status: "adopted" }
  | { status: "matches" }
  | { status: "refused"; reason: string }
  | { status: "drifted"; diff: string };

/**
 * Records `0000_baseline` as applied on a database whose schema came from
 * `db:push`, writing Drizzle's migrations table the way its migrator would.
 */
export async function adoptBaseline(
  options: Readonly<AdoptBaselineOptions>,
): Promise<AdoptBaselineResult> {
  const folder = options.migrationsFolder ?? migrationsFolder;
  const tags = readJournalTags(folder);
  if (tags.length !== 1 || tags[0] !== BASELINE_TAG) {
    return {
      status: "refused",
      reason: `The journal must hold only ${BASELINE_TAG}, but holds: ${tags.join(", ") || "nothing"}`,
    };
  }
  const [baseline] = readMigrationFiles({ migrationsFolder: folder });
  if (!baseline) {
    throw new Error(`${BASELINE_TAG} is missing from ${folder}`);
  }

  const pool = new Pool({ connectionString: options.url });
  try {
    const existing = await pool.query<{ table: string | null }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS table",
    );
    if (existing.rows[0]?.table) {
      return {
        status: "refused",
        reason:
          "drizzle.__drizzle_migrations already exists, so this database already tracks migrations",
      };
    }

    const diff = await diffAgainstBaseline(options.url, folder);
    if (diff !== undefined) {
      return { status: "drifted", diff };
    }
    if (options.check) {
      return { status: "matches" };
    }

    const client = await pool.connect();
    let discardClient = false;
    try {
      await client.query("BEGIN");
      // Mirrors the schema, table and row that drizzle-orm 0.45's PostgreSQL
      // migrator writes, so a later `migrate` reads this row as its own. The
      // row-format test in adopt-baseline.integration.test.ts guards it.
      await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
      await client.query(
        "CREATE TABLE drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)",
      );
      await client.query(
        "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
        [baseline.hash, baseline.folderMillis],
      );
      await client.query("COMMIT");
    } catch (error) {
      // A failed ROLLBACK must not replace the error that caused it; the
      // client is then discarded instead of returned to the pool.
      await client.query("ROLLBACK").catch(() => {
        discardClient = true;
      });
      throw error;
    } finally {
      client.release(discardClient);
    }
  } finally {
    await pool.end();
  }
  return { status: "adopted" };
}
