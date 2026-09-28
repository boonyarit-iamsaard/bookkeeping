import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { parse } from "pg-connection-string";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
const localDatabaseHosts = new Set(["localhost", "127.0.0.1"]);

// Resolve the host the way `pg` will connect, so a `?host=` query parameter
// cannot redirect a URL whose authority names localhost.
function assertLocalDatabaseUrl(url: string): void {
  const host = parse(url).host ?? "";
  if (!localDatabaseHosts.has(host)) {
    throw new Error(`Refusing to reset non-local database host "${host}"`);
  }
}

export async function migrateDatabase(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
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
