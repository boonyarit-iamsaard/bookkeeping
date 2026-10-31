import { parse } from "pg-connection-string";

// Loopback hosts, which reach a database on this machine. `::1` belongs here:
// `db:fresh` may reset it, and the baseline diff must reroute it, since inside
// its container `::1` would reach the throwaway database instead.
export const localDatabaseHosts: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

// Resolve the host the way `pg` will connect, so a `?host=` query parameter
// cannot redirect a URL whose authority names localhost.
export function assertLocalDatabaseUrl(url: string): void {
  const host = parse(url).host ?? "";
  if (!localDatabaseHosts.has(host)) {
    throw new Error(`Refusing to reset non-local database host "${host}"`);
  }
}
