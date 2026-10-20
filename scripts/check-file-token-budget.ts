import { execFileSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  OversizedFile,
  StagedFile,
} from "./file-token-budget/find-oversized-files";
import {
  BYTES_PER_TOKEN,
  findOversizedFiles,
  MAX_BYTES,
  TOKEN_LIMIT,
} from "./file-token-budget/find-oversized-files";
import { scriptArguments } from "./sonar/arguments";

const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const MAX_FILE_BYTES = 256 * 1024 * 1024;

// lint-staged passes absolute paths; git needs repository-relative ones. The
// index holds what the commit records, so a partly staged file is checked as
// it will be committed.
function readIndexedFile(argument: string): StagedFile {
  const path = relative(repositoryDirectory, resolve(argument))
    .split(sep)
    .join("/");
  const content = execFileSync("git", ["show", `:${path}`], {
    cwd: repositoryDirectory,
    maxBuffer: MAX_FILE_BYTES,
  });
  return { path, content };
}

function formatReport(oversized: readonly OversizedFile[]): string {
  return [
    `Staged files must stay at or below ${TOKEN_LIMIT} tokens (${MAX_BYTES} bytes; tokens = bytes / ${BYTES_PER_TOKEN}).`,
    ...oversized.map(({ path, tokens }) => `  ${path}: about ${tokens} tokens`),
    "",
    "Split each file above so that every part is within the limit:",
    "  1. Unstage the file so you can rewrite it: git restore --staged <path>",
    "  2. List its top-level declarations (functions, types, constants, components) and group the ones that change together and that callers use together.",
    "  3. Move each group into a sibling file named for its concept, following docs/code-conventions.md#filenames-and-symbols. For example, transaction.ts can become transaction-create.ts and transaction-update.ts. Update each import, and delete the original once nothing remains in it.",
    `  4. Check each part: wc -c <path> must print ${MAX_BYTES} or less.`,
    "  5. Stage the new files together with every file whose imports changed, then commit. The commit must still build and pass its tests.",
    "Generated files (lockfiles, *.gen.ts, openapi.json, drizzle migrations) and binary files are exempt.",
  ].join("\n");
}

function main(): void {
  const files = scriptArguments().map(readIndexedFile);
  const oversized = findOversizedFiles(files);
  if (oversized.length > 0) {
    console.error(formatReport(oversized));
    process.exitCode = 1;
  }
}

main();
