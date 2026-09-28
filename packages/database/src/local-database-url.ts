import { parse } from "pg-connection-string";

const localDatabaseHosts = new Set(["localhost", "127.0.0.1"]);

// Resolve the host the way `pg` will connect, so a `?host=` query parameter
// cannot redirect a URL whose authority names localhost.
export function assertLocalDatabaseUrl(url: string): void {
  const host = parse(url).host ?? "";
  if (!localDatabaseHosts.has(host)) {
    throw new Error(`Refusing to reset non-local database host "${host}"`);
  }
}
