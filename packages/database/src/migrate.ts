import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertLocalDatabaseUrl } from "./local-database-url";

export const migrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);

export interface MigrateDatabaseOptions {
  /** Overrides the committed migrations, for tests and baseline checks. */
  migrationsFolder?: string;
}

export async function migrateDatabase(
  url: string,
  options: Readonly<MigrateDatabaseOptions> = {},
): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: options.migrationsFolder ?? migrationsFolder,
    });
  } finally {
    await pool.end();
  }
}

export async function freshDatabase(url: string): Promise<void> {
  assertLocalDatabaseUrl(url);

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;
    `);
  } finally {
    await pool.end();
  }

  await migrateDatabase(url);
}
