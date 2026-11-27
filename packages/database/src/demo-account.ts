import type { Pool } from "pg";

/** The one Account `db:seed` owns; a reset or seed never counts it as foreign. */
export const demoAccountEmail = "demo@bookkeeping.localhost";

export const allowOtherAccountsFlag = "--allow-other-accounts";

/**
 * A loopback URL can still reach production through a forwarded port, so a
 * destructive local command also refuses a database that holds an Account
 * other than the demo one. A database with no `users` table yet (never
 * migrated) holds none.
 */
export async function assertNoOtherAccounts(
  pool: Pick<Pool, "query">,
  action: string,
): Promise<void> {
  const tableCheck = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass('public.users') IS NOT NULL AS exists",
  );
  if (!tableCheck.rows[0]?.exists) {
    return;
  }
  const others = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM public.users WHERE email <> $1",
    [demoAccountEmail],
  );
  if ((others.rows[0]?.count ?? 0) > 0) {
    throw new Error(
      `Refusing to ${action}: the database holds Accounts other than ${demoAccountEmail}. Pass ${allowOtherAccountsFlag} to proceed anyway.`,
    );
  }
}
