import { readFileSync } from "node:fs";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { parse } from "pg-connection-string";
import { diffLines } from "./line-diff";
import { migrateDatabase } from "./migrate";

// The backup job pins the PostgreSQL image, so its pg_dump is the one that
// has to read production; reading the pin keeps one source for it.
const backupDockerfile = new URL(
  "../../../apps/backup/Dockerfile",
  import.meta.url,
);

const DUMP_ARGUMENTS = [
  "pg_dump",
  "--schema-only",
  "--no-owner",
  "--no-privileges",
  "--exclude-schema=drizzle",
];

// pg_dump's comments, session settings and the random `\restrict` key differ
// between runs and servers without describing the schema.
const IGNORED_LINE_PREFIXES = [
  "--",
  "SET ",
  "SELECT pg_catalog.set_config",
  "\\restrict",
  "\\unrestrict",
];

const DOCKER_HOST_ALIAS = "host.docker.internal";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function readPinnedPostgresImage(): string {
  const dockerfile = readFileSync(backupDockerfile, "utf8");
  const image = /^FROM (postgres:\S+@sha256:[0-9a-f]+)/m.exec(dockerfile)?.[1];
  if (!image) {
    throw new Error(`No pinned postgres image in ${backupDockerfile.pathname}`);
  }
  return image;
}

function normalizeDump(dump: string): string[] {
  return dump
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        line !== "" &&
        !IGNORED_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)),
    );
}

async function dump(
  container: StartedPostgreSqlContainer,
  environment: Readonly<Record<string, string>>,
): Promise<string[]> {
  const result = await container.exec(DUMP_ARGUMENTS, { env: environment });
  if (result.exitCode !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr.trim()}`);
  }
  return normalizeDump(result.stdout);
}

// libpq reads the connection from the environment, so the password never
// appears in a command line. A target on this machine is reached from inside
// the container through Docker's host gateway.
function libpqEnvironment(url: string): Record<string, string> {
  const connection = parse(url);
  const host = connection.host ?? "localhost";
  const environment: Record<string, string> = {
    PGHOST: localHosts.has(host) ? DOCKER_HOST_ALIAS : host,
    PGPORT: connection.port ?? "5432",
    PGUSER: connection.user ?? "postgres",
    PGPASSWORD: connection.password ?? "",
    PGDATABASE: connection.database ?? "postgres",
  };
  const sslMode = new URL(url).searchParams.get("sslmode");
  if (sslMode) {
    environment.PGSSLMODE = sslMode;
  }
  return environment;
}

/**
 * Applies the baseline to a throwaway PostgreSQL from the pinned image and
 * diffs both schema dumps. Returns the diff, or `undefined` when the target
 * matches. The container is removed either way.
 */
export async function diffAgainstBaseline(
  url: string,
  migrationsFolder: string,
): Promise<string | undefined> {
  const container = await new PostgreSqlContainer(readPinnedPostgresImage())
    .withExtraHosts([{ host: DOCKER_HOST_ALIAS, ipAddress: "host-gateway" }])
    .start();
  try {
    await migrateDatabase(container.getConnectionUri(), { migrationsFolder });
    const baseline = await dump(container, {
      PGUSER: container.getUsername(),
      PGDATABASE: container.getDatabase(),
    });
    const target = await dump(container, libpqEnvironment(url));
    const diff = diffLines(baseline, target);
    return diff === undefined
      ? undefined
      : `--- the baseline on a throwaway database\n+++ target database\n${diff}`;
  } finally {
    await container.stop();
  }
}
