import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findDeclarationOrderViolations } from "./declaration-order/find-declaration-order-violations";
import { scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const sourcePatterns = ["*.ts", "*.tsx", "*.mts"];
// Generated files, such as the route tree and the OpenAPI types.
const generatedSuffix = ".gen.ts";

// lint-staged passes the staged sources; with none, CI checks every tracked
// source.
function chooseFiles(paths: readonly string[]): string[] {
  const files =
    paths.length > 0
      ? paths.map((path) => resolve(path))
      : execFileSync("git", ["ls-files", "-z", "--", ...sourcePatterns], {
          cwd: repositoryDirectory,
          encoding: "utf8",
        })
          .split("\0")
          .filter(Boolean)
          .map((path) => resolve(repositoryDirectory, path));
  return files.filter((file) => !file.endsWith(generatedSuffix));
}

function main(): void {
  let violationCount = 0;

  for (const file of chooseFiles(scriptArguments())) {
    const name = relative(repositoryDirectory, file);
    for (const { line, name: functionName } of findDeclarationOrderViolations(
      readFileSync(file, "utf8"),
      file,
    )) {
      console.error(`${name}:${line}: ${functionName} is declared below`);
      violationCount += 1;
    }
  }

  if (violationCount > 0) {
    console.error(
      `\n${violationCount} reference(s) to a function declared below. Move each function above its first use, or mark a necessary exception with \`// declaration-order-ignore: <reason>\`.`,
    );
    process.exitCode = 1;
  }
}

main();
