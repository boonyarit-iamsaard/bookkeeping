import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { testDatabaseUrl } from "./url";

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

/**
 * Runs `use` against an empty database of its own in the test container, so
 * a test that resets or breaks its schema cannot leave later test files
 * without one.
 */
export async function withEmptyDatabase(
  use: (url: string) => Promise<void>,
): Promise<void> {
  const sharedUrl = testDatabaseUrl();
  const name = `own_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(sharedUrl);
  url.pathname = `/${name}`;
  const admin = new Pool({ connectionString: sharedUrl });
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    let succeeded = false;
    try {
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
