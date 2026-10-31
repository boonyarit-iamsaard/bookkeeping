import { sql } from "drizzle-orm";
import { Client } from "pg";
import { createDatabase } from "../connection";

/** Whether the `wallets` table has `column`, as a migration may add it. */
export async function hasWalletColumn(
  url: string,
  column: string,
): Promise<boolean> {
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

/**
 * Runs `use` while another connection holds an exclusive lock on `wallets`,
 * as a long query from the running app would. The lock's transaction changes
 * nothing and rolls back once `use` settles.
 */
export async function withLockedWallets<T>(
  url: string,
  use: () => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE wallets IN ACCESS EXCLUSIVE MODE");
    return await use();
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}
