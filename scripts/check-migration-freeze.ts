import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findMigrationFreezeViolations,
  JOURNAL_PATH,
} from "./migration-freeze/migration-freeze";

const REPOSITORY_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));
const MIGRATIONS_DIRECTORY = "packages/database/drizzle";
const MAIN_REF = "refs/remotes/origin/main";

function git(commandArguments: readonly string[]): string {
  return execFileSync("git", commandArguments, {
    cwd: REPOSITORY_DIRECTORY,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function hasRef(ref: string): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

// CI's checkout is a depth-1 clone of the pull request's merge commit, which
// lacks `main`; the repository is public, so the fetch needs no credentials.
function resolveMain(): string {
  if (!hasRef(MAIN_REF)) {
    git([
      "fetch",
      "--no-tags",
      "--depth=1",
      "origin",
      `+refs/heads/main:${MAIN_REF}`,
    ]);
  }
  return MAIN_REF;
}

function main(): void {
  const mainCommit = resolveMain();
  // Compares the working tree, so uncommitted edits are caught as well.
  const nameStatus = git([
    "diff",
    "--no-renames",
    "--name-status",
    mainCommit,
    "--",
    MIGRATIONS_DIRECTORY,
  ]);
  const journalModified = nameStatus.split("\n").includes(`M\t${JOURNAL_PATH}`);
  const violations = findMigrationFreezeViolations({
    nameStatus,
    journal: journalModified
      ? {
          main: git(["show", `${mainCommit}:${JOURNAL_PATH}`]),
          current: readFileSync(
            join(REPOSITORY_DIRECTORY, JOURNAL_PATH),
            "utf8",
          ),
        }
      : undefined,
  });

  if (violations.length > 0) {
    console.error(
      [
        "Committed migrations are frozen: production has applied them.",
        "Add a new migration instead of changing these files from main:",
        ...violations.map((violation) => `  ${violation}`),
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  console.log("Committed migrations match main; new migrations only add.");
}

main();
