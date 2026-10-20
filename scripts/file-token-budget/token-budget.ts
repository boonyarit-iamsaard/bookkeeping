import { z } from "zod";

export const TOKEN_LIMIT = 5_000;
export const BYTES_PER_TOKEN = 4;
export const MAX_BYTES = TOKEN_LIMIT * BYTES_PER_TOKEN;

// Files the agents did not author. The lockfile and codegen are written by
// tools, and splitting them by hand would break their regeneration.
const EXEMPT_PATH_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /\.gen\.ts$/,
  /(^|\/)openapi\.json$/,
  /^packages\/database\/drizzle\//,
];

export interface TrackedFile {
  path: string;
  content: Buffer;
}

// Maps each path that already exceeds the limit to its current byte size. Such
// a file may shrink, but it may not grow, and its entry shrinks with it.
const baselineSchema = z.record(z.string(), z.number().int().positive());

export type Baseline = z.infer<typeof baselineSchema>;

export type Violation =
  | { kind: "oversized"; path: string; tokens: number }
  | { kind: "grew"; path: string; bytes: number; baselineBytes: number }
  | { kind: "shrank"; path: string; bytes: number; baselineBytes: number }
  | { kind: "within-limit"; path: string }
  | { kind: "untracked"; path: string }
  | { kind: "baseline-added"; path: string }
  | {
      kind: "baseline-raised";
      path: string;
      bytes: number;
      committedBytes: number;
    };

export function parseBaseline(text: string): Baseline {
  return baselineSchema.parse(JSON.parse(text));
}

export function isExemptPath(path: string): boolean {
  return EXEMPT_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

// A NUL byte marks binary content, where a bytes-per-token estimate means
// nothing.
function isBinary(content: Buffer): boolean {
  return content.includes(0);
}

function estimateTokens(content: Buffer): number {
  return Math.ceil(content.length / BYTES_PER_TOKEN);
}

function isCountedFile({ path, content }: TrackedFile): boolean {
  return !isExemptPath(path) && !isBinary(content);
}

export interface ViolationInput {
  // Every path in the index, so a baseline entry for a file that a commit
  // deleted or renamed is reported even when that file was not checked.
  trackedPaths: readonly string[];
  baseline: Baseline;
}

export function findViolations(
  files: readonly TrackedFile[],
  { trackedPaths, baseline }: ViolationInput,
): Violation[] {
  const violations: Violation[] = [];

  for (const { path, content } of files.filter(isCountedFile)) {
    const tokens = estimateTokens(content);
    const bytes = content.length;
    const baselineBytes = baseline[path];

    if (baselineBytes === undefined) {
      if (tokens > TOKEN_LIMIT) {
        violations.push({ kind: "oversized", path, tokens });
      }
    } else if (tokens <= TOKEN_LIMIT) {
      violations.push({ kind: "within-limit", path });
    } else if (bytes > baselineBytes) {
      violations.push({ kind: "grew", path, bytes, baselineBytes });
    } else if (bytes < baselineBytes) {
      violations.push({ kind: "shrank", path, bytes, baselineBytes });
    }
  }

  const tracked = new Set(trackedPaths);
  for (const path of Object.keys(baseline)) {
    if (!tracked.has(path)) {
      violations.push({ kind: "untracked", path });
    }
  }

  return violations;
}

// Only the owner adds a file to the baseline or raises its entry; anyone may
// lower or remove one.
export function findBaselineChanges(
  committed: Baseline,
  staged: Baseline,
): Violation[] {
  const violations: Violation[] = [];

  for (const [path, bytes] of Object.entries(staged)) {
    const committedBytes = committed[path];
    if (committedBytes === undefined) {
      violations.push({ kind: "baseline-added", path });
    } else if (bytes > committedBytes) {
      violations.push({ kind: "baseline-raised", path, bytes, committedBytes });
    }
  }

  return violations;
}
