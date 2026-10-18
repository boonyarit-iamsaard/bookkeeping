import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findPublicIdentifiers } from "./public-identifiers/find-public-identifiers";
import { scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const documentPatterns = ["*.md", "*.html", "*.yaml", "*.yml"];

// lint-staged passes the staged documents; with none, CI checks every tracked
// document.
function chooseFiles(paths: readonly string[]): string[] {
  if (paths.length > 0) {
    return paths.map((path) => resolve(path));
  }
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--", ...documentPatterns],
    { cwd: repositoryDirectory, encoding: "utf8" },
  );
  return output
    .split("\0")
    .filter(Boolean)
    .map((path) => resolve(repositoryDirectory, path));
}

function main(): void {
  let findingCount = 0;

  for (const file of chooseFiles(scriptArguments())) {
    const name = relative(repositoryDirectory, file);
    for (const { line, kind } of findPublicIdentifiers(
      readFileSync(file, "utf8"),
    )) {
      console.error(`${name}:${line}: ${kind}`);
      findingCount += 1;
    }
  }

  if (findingCount > 0) {
    console.error(
      `\n${findingCount} identifier(s) would be published. This repository is public: replace each with a placeholder such as <BACKUPS_ACCOUNT_ID>.`,
    );
    process.exitCode = 1;
  }
}

main();
