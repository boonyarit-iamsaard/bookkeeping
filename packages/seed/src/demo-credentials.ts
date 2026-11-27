import type { DemoCredentials } from "./sample-ledger";

/** What `db:seed` and `db:fresh --seed` print, so a person can sign in at once. */
export function formatDemoCredentials({
  email,
  password,
}: Readonly<DemoCredentials>): string {
  return `Seeded the sample ledger. Sign in with:\n  email:    ${email}\n  password: ${password}`;
}
