import { chmod, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrationsFolder } from "../migrate";

const secondMigrationFixture = fileURLToPath(
  new URL("fixtures/second-migration", import.meta.url),
);

/** The column the fixture's `0001_add_fixture_column` adds to `wallets`. */
export const fixtureColumn = "fixture_column";

/**
 * Runs `use` with a migrations folder holding the committed migrations plus
 * the test-only `0001_add_fixture_column`, a stand-in for the next migration.
 */
export async function withSecondMigrationFolder(
  use: (folder: string) => Promise<void>,
): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), "second-migration-"));
  try {
    // Readable from a container, which may run as another user.
    await chmod(folder, 0o755);
    await cp(migrationsFolder, folder, { recursive: true });
    await cp(secondMigrationFixture, folder, { recursive: true });
    await use(folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
