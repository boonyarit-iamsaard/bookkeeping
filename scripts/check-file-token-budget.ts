import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Baseline,
  TrackedFile,
  Violation,
} from "./file-token-budget/token-budget";
import {
  BYTES_PER_TOKEN,
  buildBaseline,
  findViolations,
  MAX_BYTES,
  TOKEN_LIMIT,
} from "./file-token-budget/token-budget";
import { scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const baselinePath = "scripts/file-token-budget/baseline.json";
const MAX_FILE_BYTES = 256 * 1024 * 1024;

// lint-staged passes absolute paths; git needs repository-relative ones.
function toRepositoryPath(argument: string): string {
  return relative(repositoryDirectory, resolve(argument)).split(sep).join("/");
}

// Every check reads the index, so it judges what the commit records, and CI
// (which checks out the committed tree) judges the same bytes.
function readIndexedFile(path: string): TrackedFile {
  const content = execFileSync("git", ["show", `:${path}`], {
    cwd: repositoryDirectory,
    maxBuffer: MAX_FILE_BYTES,
  });
  return { path, content };
}

function listIndexedPaths(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryDirectory,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function readBaseline(trackedPaths: readonly string[]): Baseline {
  if (!trackedPaths.includes(baselinePath)) {
    return {};
  }
  return JSON.parse(readIndexedFile(baselinePath).content.toString("utf8"));
}

function describeViolation(violation: Violation): string {
  switch (violation.kind) {
    case "oversized":
      return `${violation.path}: about ${violation.tokens} tokens, over the ${TOKEN_LIMIT}-token limit`;
    case "grew":
      return `${violation.path}: grew from ${violation.baselineBytes} to ${violation.bytes} bytes since ${baselinePath} was written`;
    case "within-limit":
      return `${violation.path}: now within the limit; remove its entry from ${baselinePath}`;
    case "untracked":
      return `${violation.path}: listed in ${baselinePath} but no longer tracked; remove its entry`;
  }
}

function formatReport(violations: readonly Violation[]): string {
  return [
    `Files must stay at or below ${TOKEN_LIMIT} tokens (${MAX_BYTES} bytes; tokens = bytes / ${BYTES_PER_TOKEN}), unless ${baselinePath} records them.`,
    ...violations.map((violation) => `  ${describeViolation(violation)}`),
    "",
    "Agents: do not split, baseline, or bypass this check on your own. Do not use --no-verify, and do not add entries to baseline.json.",
    "For each oversized or grown file, do this and wait for the user's decision before editing:",
    "  1. Read the file, and list its top-level declarations and their callers.",
    "  2. Propose a split: the groups, the new file names (docs/code-conventions.md#file-size), and the importers that change.",
    "  3. Ask the user to approve that split, choose another, or keep the file in the baseline. Edit only after they decide.",
    "  4. After approval, split the file, check each part with wc -c <path> (at most " +
      `${MAX_BYTES} bytes), stage the new files with the importers, and commit. The commit must still build and pass its tests.`,
    "For a within-limit or untracked entry, remove the entry from baseline.json in the same commit. That needs no decision.",
  ].join("\n");
}

function writeBaseline(): void {
  const trackedPaths = listIndexedPaths();
  const files = trackedPaths.map(readIndexedFile);
  const baseline = buildBaseline(files);
  const absolutePath = join(repositoryDirectory, baselinePath);
  writeFileSync(absolutePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Wrote ${Object.keys(baseline).length} entries to ${baselinePath}. Stage it with the change that needs it.`,
  );
}

function main(): void {
  const argumentsList = scriptArguments();
  if (argumentsList[0] === "--write-baseline") {
    writeBaseline();
    return;
  }

  // With no arguments (CI), every tracked file is checked; lint-staged passes
  // the staged paths.
  const trackedPaths = listIndexedPaths();
  const checkedPaths =
    argumentsList.length > 0
      ? argumentsList.map(toRepositoryPath)
      : trackedPaths;
  const files = checkedPaths.map(readIndexedFile);
  const violations = findViolations(files, {
    trackedPaths,
    baseline: readBaseline(trackedPaths),
  });

  if (violations.length > 0) {
    console.error(formatReport(violations));
    process.exitCode = 1;
  }
}

main();
