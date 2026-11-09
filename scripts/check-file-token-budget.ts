import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Baseline,
  BaselineCorrection,
  TrackedFile,
  Violation,
} from "./file-token-budget/token-budget";
import {
  applyBaselineCorrections,
  BYTES_PER_TOKEN,
  findBaselineChanges,
  findViolations,
  formatBaseline,
  isBaselineCorrection,
  MAX_BYTES,
  parseBaseline,
  TOKEN_LIMIT,
} from "./file-token-budget/token-budget";
import { scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const baselinePath = "scripts/file-token-budget/baseline.json";
// The owner sets this to commit a new or raised baseline entry.
const ownerApprovalVariable = "FILE_TOKEN_BUDGET_OWNER_APPROVED";
// Room for reading every tracked file in one batch.
const gitReadMaxBuffer = 256 * 1024 * 1024;

// lint-staged passes absolute paths; git needs repository-relative ones.
function toRepositoryPath(argument: string): string {
  return relative(repositoryDirectory, resolve(argument)).split(sep).join("/");
}

// Reads objects such as `:path` (the index) or `HEAD:path` in one git process.
// A missing object reads as undefined.
function readGitObjects(names: readonly string[]): (Buffer | undefined)[] {
  if (names.length === 0) {
    return [];
  }
  const output = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repositoryDirectory,
    input: names.map((name) => `${name}\n`).join(""),
    maxBuffer: gitReadMaxBuffer,
  });

  let offset = 0;
  return names.map(() => {
    const headerEnd = output.indexOf("\n", offset);
    const header = output.toString("utf8", offset, headerEnd);
    offset = headerEnd + 1;
    if (header.endsWith(" missing")) {
      return undefined;
    }
    const size = Number(header.split(" ")[2]);
    const content = output.subarray(offset, offset + size);
    offset += size + 1;
    return content;
  });
}

// Every check reads the index, so it judges what the commit records, and CI
// (which checks out the committed tree) judges the same bytes.
function readIndexedFiles(paths: readonly string[]): TrackedFile[] {
  const contents = readGitObjects(paths.map((path) => `:${path}`));
  return paths.map((path, index) => {
    const content = contents[index];
    if (content === undefined) {
      throw new Error(`${path} is not in the index`);
    }
    return { path, content };
  });
}

function listIndexedPaths(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryDirectory,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function toBaseline(content: Buffer | undefined): Baseline {
  return content === undefined ? {} : parseBaseline(content.toString("utf8"));
}

// Lowers or removes entries in both the working tree and the index. It leaves
// the file alone when its working copy differs from the staged one, so an
// unstaged edit is never overwritten; the corrections are then reported.
function applyStagedCorrections(
  stagedBaselineFile: Buffer | undefined,
  corrections: readonly BaselineCorrection[],
): boolean {
  const absolutePath = resolve(repositoryDirectory, baselinePath);
  if (
    stagedBaselineFile === undefined ||
    !existsSync(absolutePath) ||
    !readFileSync(absolutePath).equals(stagedBaselineFile)
  ) {
    return false;
  }
  const corrected = applyBaselineCorrections(
    toBaseline(stagedBaselineFile),
    corrections,
  );
  writeFileSync(absolutePath, formatBaseline(corrected));
  execFileSync("git", ["add", "--", baselinePath], {
    cwd: repositoryDirectory,
  });
  console.error(
    [
      `Updated ${baselinePath} and staged it:`,
      ...corrections.map((correction) =>
        correction.kind === "shrank"
          ? `  ${correction.path}: lowered from ${correction.baselineBytes} to ${correction.bytes} bytes`
          : `  ${correction.path}: removed (${correction.kind})`,
      ),
    ].join("\n"),
  );
  return true;
}

function describeViolation(violation: Violation): string {
  switch (violation.kind) {
    case "oversized":
      return `${violation.path}: about ${violation.tokens} tokens, over the ${TOKEN_LIMIT}-token limit`;
    case "grew":
      return `${violation.path}: grew from ${violation.baselineBytes} to ${violation.bytes} bytes since ${baselinePath} recorded it`;
    case "shrank":
      return `${violation.path}: shrank to ${violation.bytes} bytes; lower its entry in ${baselinePath} from ${violation.baselineBytes} to ${violation.bytes}`;
    case "within-limit":
      return `${violation.path}: now within the limit; remove its entry from ${baselinePath}`;
    case "untracked":
      return `${violation.path}: listed in ${baselinePath} but no longer tracked; remove its entry`;
    case "baseline-added":
      return `${violation.path}: added to ${baselinePath} without the owner's approval`;
    case "baseline-raised":
      return `${violation.path}: raised from ${violation.committedBytes} to ${violation.bytes} bytes in ${baselinePath} without the owner's approval`;
  }
}

function formatReport(violations: readonly Violation[]): string {
  return [
    `Files must stay at or below ${TOKEN_LIMIT} tokens (${MAX_BYTES} bytes; tokens = bytes / ${BYTES_PER_TOKEN}), unless ${baselinePath} records them.`,
    ...violations.map((violation) => `  ${describeViolation(violation)}`),
    "",
    `Agents: do not split, baseline, or bypass this check on your own. Do not use --no-verify, do not set ${ownerApprovalVariable}, and do not add or raise entries in baseline.json.`,
    "For each oversized or grown file, do this and wait for the user's decision before editing:",
    "  1. Read the file, and list its top-level declarations and their callers.",
    "  2. Propose a split: the groups, the new file names (docs/code-conventions.md#file-size), and the importers that change.",
    "  3. Ask the user to approve that split, choose another, or keep the file in the baseline. Edit only after they decide.",
    "  4. After approval, split the file, check each part with wc -c <path> (at most " +
      `${MAX_BYTES} bytes), stage the new files with the importers, and commit. The commit must still build and pass its tests.`,
    "For a shrank, within-limit, or untracked entry, lower or remove the entry in baseline.json in the same commit. That needs no decision, and the pre-commit hook does it unless baseline.json has unstaged edits.",
  ].join("\n");
}

function main(): void {
  const argumentsList = scriptArguments();
  const isStagedCheck = argumentsList.length > 0;

  // With no arguments (CI), every tracked file is checked; lint-staged passes
  // the staged paths.
  const trackedPaths = listIndexedPaths();
  const checkedPaths = isStagedCheck
    ? argumentsList.map(toRepositoryPath)
    : trackedPaths;
  const [stagedBaselineFile, committedBaselineFile] = readGitObjects([
    `:${baselinePath}`,
    `HEAD:${baselinePath}`,
  ]);
  const stagedBaseline = toBaseline(stagedBaselineFile);
  const committedBaseline = toBaseline(committedBaselineFile);

  let violations = findViolations(readIndexedFiles(checkedPaths), {
    trackedPaths,
    baseline: stagedBaseline,
  });
  // CI reports a stale entry instead, so a commit that skipped the hook fails.
  const corrections = violations.filter(isBaselineCorrection);
  if (
    isStagedCheck &&
    corrections.length > 0 &&
    applyStagedCorrections(stagedBaselineFile, corrections)
  ) {
    violations = violations.filter(
      (violation) => !isBaselineCorrection(violation),
    );
  }
  // CI leaves baseline changes to pull request review.
  if (isStagedCheck && process.env[ownerApprovalVariable] !== "1") {
    violations.push(...findBaselineChanges(committedBaseline, stagedBaseline));
  }

  if (violations.length > 0) {
    console.error(formatReport(violations));
    process.exitCode = 1;
  }
}

main();
