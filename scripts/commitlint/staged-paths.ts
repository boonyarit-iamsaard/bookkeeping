import { execFileSync } from "node:child_process";

/**
 * Lists the paths the commit in progress changes, including both sides of a
 * move. Git points `GIT_INDEX_FILE` at the commit's index while hooks run, so
 * `git commit -a` and `git commit <paths>` are read correctly.
 */
export function readStagedPaths(): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--no-renames", "-z"],
    { encoding: "utf8" },
  );

  return output.split("\0").filter(Boolean);
}
