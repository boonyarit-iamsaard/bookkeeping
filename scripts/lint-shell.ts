import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { shellcheckDockerArguments } from "./shellcheck/shellcheck-arguments";

// `resolve` drops the trailing separator the URL path carries, which would
// otherwise end up inside the docker volume spec.
const repositoryDirectory = resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);

function trackedShellScripts(): string[] {
  const output = execFileSync("git", ["ls-files", "-z", "--", "*.sh"], {
    cwd: repositoryDirectory,
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

function main(): void {
  const dockerArguments = shellcheckDockerArguments({
    repository: repositoryDirectory,
    files: trackedShellScripts(),
  });
  if (dockerArguments === null) {
    console.log("No shell scripts are tracked; nothing to lint.");
    return;
  }
  const { status, error } = spawnSync("docker", dockerArguments, {
    cwd: repositoryDirectory,
    stdio: "inherit",
  });
  if (error) {
    console.error(`Could not run docker: ${error.message}`);
  }
  process.exitCode = status ?? 1;
}

main();
