import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createDatabase } from "@bookkeeping/database/connection";
import { withEmptyDatabase } from "@bookkeeping/database/testing/empty-database";
import {
  nextMigrationColumn,
  withNextMigrationFolder,
} from "@bookkeeping/database/testing/next-migration";
import {
  hasWalletColumn,
  withLockedWallets,
} from "@bookkeeping/database/testing/wallets-table";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import * as z from "zod";
import { LOCK_TIMEOUT_MS } from "./migration-lock";

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

async function countAppliedMigrations(url: string): Promise<number> {
  const connection = createDatabase(url);
  try {
    const result = await connection.db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    );
    return result.rows[0]?.count ?? 0;
  } finally {
    await connection.close();
  }
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

        await withNextMigrationFolder(async (folder) => {
          const result = await runMigrate(url, folder);

          expect(result).toMatchObject({ exitCode: 0 });
        });
        expect(await countAppliedMigrations(url)).toBe(2);
        expect(await hasWalletColumn(url, nextMigrationColumn)).toBe(true);
      });
    },
  );

  test(
    `gives up on a held lock after ${LOCK_TIMEOUT_MS} ms and applies nothing`,
    runTestOptions,
    async () => {
      await withEmptyDatabase(async (url) => {
        expect(await runMigrate(url)).toMatchObject({ exitCode: 0 });

        await withLockedWallets(url, () =>
          withNextMigrationFolder(async (folder) => {
            const startedAt = Date.now();
            const result = await runMigrate(url, folder);
            const elapsed = Date.now() - startedAt;

            expect(result.exitCode).not.toBe(0);
            expect(result.output).toContain("lock timeout");
            expect(elapsed).toBeGreaterThanOrEqual(LOCK_TIMEOUT_MS);
            // Leaves room for the container to start and stop.
            expect(elapsed).toBeLessThan(LOCK_TIMEOUT_MS + 15_000);
          }),
        );
        expect(await countAppliedMigrations(url)).toBe(1);
        expect(await hasWalletColumn(url, nextMigrationColumn)).toBe(false);
      });
    },
  );
});
