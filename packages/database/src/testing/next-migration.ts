import {
  chmod,
  copyFile,
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import { migrationsFolder } from "../migrate";

const nextMigrationFixture = fileURLToPath(
  new URL("fixtures/second-migration", import.meta.url),
);

/** The column the next migration fixture adds to `wallets`. */
export const nextMigrationColumn = "fixture_column";

const journalSchema = z.looseObject({
  entries: z.array(
    z.looseObject({ idx: z.number(), when: z.number(), tag: z.string() }),
  ),
});

export async function readMigrationJournal(
  folder: string,
): Promise<z.infer<typeof journalSchema>> {
  return journalSchema.parse(
    JSON.parse(await readFile(join(folder, "meta/_journal.json"), "utf8")),
  );
}

/**
 * Runs `use` with the committed migrations plus a test-only migration whose
 * timestamp follows the latest committed entry, so Drizzle cannot skip it.
 */
export async function withNextMigrationFolder(
  use: (folder: string) => Promise<void>,
): Promise<void> {
  const folder = await mkdtemp(join(tmpdir(), "next-migration-"));
  try {
    // Readable from a container, which may run as another user.
    await chmod(folder, 0o755);
    await cp(migrationsFolder, folder, { recursive: true });
    const journalPath = join(folder, "meta/_journal.json");
    const journal = await readMigrationJournal(folder);
    const latest = journal.entries.at(-1);
    if (!latest) {
      throw new Error("The committed migration journal is empty");
    }
    const idx = latest.idx + 1;
    const tag = `${String(idx).padStart(4, "0")}_add_fixture_column`;
    journal.entries.push({ ...latest, idx, when: latest.when + 1, tag });
    await copyFile(
      join(nextMigrationFixture, "0001_add_fixture_column.sql"),
      join(folder, `${tag}.sql`),
    );
    await writeFile(journalPath, JSON.stringify(journal));
    await use(folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
