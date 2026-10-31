import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Database } from "@bookkeeping/database/connection";
import { createDatabase } from "@bookkeeping/database/connection";
import { withEmptyDatabase } from "@bookkeeping/database/testing/empty-database";
import {
  fixtureColumn,
  withSecondMigrationFolder,
} from "@bookkeeping/database/testing/second-migration";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import * as z from "zod";

// Builds the api image and runs its pre-deploy command, `node dist/migrate.js`,
// against an empty database of its own. Opt-in through `pnpm test:image`: a
// production image build is too heavy for the routine suites.

const IMAGE = "bookkeeping-api-migrate-test";
const DOCKER_HOST_ALIAS = "host.docker.internal";
const repositoryDirectory = fileURLToPath(new URL("../../..", import.meta.url));
const runTestOptions = { timeout: 60_000 };

const run = promisify(execFile);

beforeAll(async () => {
  await run(
    "docker",
    ["build", "-f", "apps/server/Dockerfile", "-t", IMAGE, "."],
    { cwd: repositoryDirectory, maxBuffer: 64 * 1024 * 1024 },
  );
}, 900_000);

// What `execFile` rejects with when the command exits non-zero.
const execFailureSchema = z.object({
  code: z.number(),
  stdout: z.string(),
  stderr: z.string(),
});

interface MigrateRun {
  exitCode: number;
  output: string;
}

/**
 * Runs the image's migrate entrypoint the way Railway's pre-deploy does, with
 * only `DATABASE_URL`. `migrationsFolder` replaces the image's migrations.
 */
async function runMigrate(
  url: string,
  migrationsFolder?: string,
): Promise<MigrateRun> {
  // The test database listens on this machine, reached through the gateway.
  const containerUrl = new URL(url);
  containerUrl.hostname = DOCKER_HOST_ALIAS;
  const volume = migrationsFolder
    ? ["--volume", `${migrationsFolder}:/app/drizzle:ro`]
    : [];
  try {
    const { stdout, stderr } = await run(
      "docker",
      [
        "run",
        "--rm",
        "--add-host",
        `${DOCKER_HOST_ALIAS}:host-gateway`,
        // Named without a value, so the password stays off the command line.
        "--env",
        "DATABASE_URL",
        ...volume,
        IMAGE,
        "node",
        "dist/migrate.js",
      ],
      { env: { ...process.env, DATABASE_URL: containerUrl.href } },
    );
    return { exitCode: 0, output: stdout + stderr };
  } catch (error: unknown) {
    const failure = execFailureSchema.parse(error);
    return { exitCode: failure.code, output: failure.stdout + failure.stderr };
  }
}

async function withDatabase<T>(
  url: string,
  use: (db: Database) => Promise<T>,
): Promise<T> {
  const connection = createDatabase(url);
  try {
    return await use(connection.db);
  } finally {
    await connection.close();
  }
}

function countAppliedMigrations(url: string): Promise<number> {
  return withDatabase(url, async (db) => {
    const result = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    );
    return result.rows[0]?.count ?? 0;
  });
}

function hasWalletColumn(url: string, column: string): Promise<boolean> {
  return withDatabase(url, async (db) => {
    const result = await db.execute(
      sql`SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'wallets'
            AND column_name = ${column}`,
    );
    return result.rows.length > 0;
  });
}

describe("the api image's migrate entrypoint", () => {
  test(
    "builds an empty database from the committed migrations",
    runTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        const result = await runMigrate(url);

        expect(result).toMatchObject({ exitCode: 0 });
        expect(await countAppliedMigrations(url)).toBe(1);
        expect(await hasWalletColumn(url, "id")).toBe(true);
      });
    },
  );

  test(
    "applies a migration added after the baseline",
    runTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        expect(await runMigrate(url)).toMatchObject({ exitCode: 0 });

        await withSecondMigrationFolder(async (folder) => {
          const result = await runMigrate(url, folder);

          expect(result).toMatchObject({ exitCode: 0 });
        });
        expect(await countAppliedMigrations(url)).toBe(2);
        expect(await hasWalletColumn(url, fixtureColumn)).toBe(true);
      });
    },
  );

  test(
    "gives up on a held lock after five seconds and applies nothing",
    runTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        expect(await runMigrate(url)).toMatchObject({ exitCode: 0 });

        await withDatabase(url, (db) =>
          db.transaction(async (holder) => {
            // A long query from the running app holding `wallets` until the
            // migrator has given up; the transaction changes nothing.
            await holder.execute(
              sql`LOCK TABLE wallets IN ACCESS EXCLUSIVE MODE`,
            );
            await withSecondMigrationFolder(async (folder) => {
              const startedAt = Date.now();
              const result = await runMigrate(url, folder);
              const elapsed = Date.now() - startedAt;

              expect(result.exitCode).not.toBe(0);
              expect(result.output).toContain("lock timeout");
              expect(elapsed).toBeGreaterThanOrEqual(5_000);
              expect(elapsed).toBeLessThan(20_000);
            });
          }),
        );
        expect(await countAppliedMigrations(url)).toBe(1);
        expect(await hasWalletColumn(url, fixtureColumn)).toBe(false);
      });
    },
  );
});
