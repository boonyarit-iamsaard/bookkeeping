import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

export const JOURNAL_PATH = "packages/database/drizzle/meta/_journal.json";

/** The journal's text on `main` and in the working tree. */
export interface JournalVersions {
  main: string;
  current: string;
}

export interface MigrationFreezeInput {
  /** `git diff --no-renames --name-status <main>` output for the folder. */
  nameStatus: string;
  journal?: JournalVersions;
}

// The letters `--no-renames --name-status` prints: added, deleted, modified,
// type-changed, unmerged, and unknown.
const migrationChangeStatusSchema = z.enum(["A", "D", "M", "T", "U", "X"]);

type MigrationChangeStatus = z.infer<typeof migrationChangeStatusSchema>;

interface MigrationChange {
  status: MigrationChangeStatus;
  path: string;
}

const journalSchema = z.looseObject({
  entries: z.array(z.looseObject({ tag: z.string() })),
});

function parseNameStatus(nameStatus: string): MigrationChange[] {
  return nameStatus
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status = "", path = ""] = line.split("\t");
      return { status: migrationChangeStatusSchema.parse(status), path };
    });
}

// The journal may only gain entries: every header field and every entry on
// `main` stays as it was, in the same position.
function findJournalViolations(journal: Readonly<JournalVersions>): string[] {
  const main = journalSchema.parse(JSON.parse(journal.main));
  const current = journalSchema.parse(JSON.parse(journal.current));
  const violations: string[] = [];

  const headerKeys = new Set([...Object.keys(main), ...Object.keys(current)]);
  headerKeys.delete("entries");
  for (const key of headerKeys) {
    if (!isDeepStrictEqual(main[key], current[key])) {
      violations.push(`${key} changed`);
    }
  }

  main.entries.forEach((entry, index) => {
    const currentEntry = current.entries[index];
    if (currentEntry === undefined) {
      violations.push(`entry ${index} (${entry.tag}) removed`);
    } else if (!isDeepStrictEqual(entry, currentEntry)) {
      violations.push(`entry ${index} (${entry.tag}) changed`);
    }
  });

  return violations.map((violation) => `${JOURNAL_PATH}: ${violation}`);
}

// Additions are the only change a committed migration history accepts. Any
// other status (modified, deleted, type-changed) rewrites a file on `main`,
// except a modified journal, which is judged entry by entry.
export function findMigrationFreezeViolations({
  nameStatus,
  journal,
}: Readonly<MigrationFreezeInput>): string[] {
  return parseNameStatus(nameStatus).flatMap(({ status, path }) => {
    if (status === "A") {
      return [];
    }
    if (status === "M" && path === JOURNAL_PATH && journal !== undefined) {
      return findJournalViolations(journal);
    }
    return [`${path}: ${status === "D" ? "deleted" : "modified"}`];
  });
}
