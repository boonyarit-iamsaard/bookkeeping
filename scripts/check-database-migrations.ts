import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const migrationsDirectory = fileURLToPath(
  new URL("../packages/database/drizzle", import.meta.url),
);
const migrationsDirectoryRelative = "packages/database/drizzle";
const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/;

function findSqlFiles(rootDirectory: string): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".sql")) {
        files.push(filePath);
      }
    }
  }

  visit(rootDirectory);
  return files.sort();
}

function runDrizzleKit(command: "generate" | "check"): void {
  const commandArguments =
    command === "generate" ? [command, "--name", "ci_drift_check"] : [command];
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@bookkeeping/database",
      "exec",
      "drizzle-kit",
      ...commandArguments,
    ],
    { cwd: repositoryDirectory, stdio: "inherit" },
  );
}

function readMigrationStatus(): string {
  return execFileSync(
    "git",
    [
      "status",
      "--short",
      "--untracked-files=all",
      "--",
      migrationsDirectoryRelative,
    ],
    { cwd: repositoryDirectory, encoding: "utf8" },
  ).trim();
}

runDrizzleKit("generate");

const invalidMigrationFiles = findSqlFiles(migrationsDirectory).filter(
  (filePath) => !migrationFilePattern.test(basename(filePath)),
);
if (invalidMigrationFiles.length > 0) {
  console.error(
    [
      "Migration SQL filenames must match ^\\d{4}_[a-z0-9_]+\\.sql$:",
      ...invalidMigrationFiles.map((filePath) =>
        join(
          "  packages/database/drizzle",
          relative(migrationsDirectory, filePath),
        ),
      ),
    ].join("\n"),
  );
  process.exit(1);
}

const migrationStatus = readMigrationStatus();
if (migrationStatus.length > 0) {
  console.error(
    [
      "The migration directory is not clean after `drizzle-kit generate`.",
      "Generate a named migration and commit every resulting migration file:",
      migrationStatus,
    ].join("\n"),
  );
  process.exit(1);
}

runDrizzleKit("check");
console.log(
  "Database migrations are generated, consistent, and correctly named.",
);
