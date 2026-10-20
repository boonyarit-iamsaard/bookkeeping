export const TOKEN_LIMIT = 5_000;
export const BYTES_PER_TOKEN = 4;
export const MAX_BYTES = TOKEN_LIMIT * BYTES_PER_TOKEN;

// Files the agents did not author. Lockfiles and codegen are written by tools,
// and splitting them by hand would break their regeneration.
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

// Maps each path that already exceeds the limit to its byte size when the
// baseline was written. Such a file may shrink, but it may not grow.
export type Baseline = Record<string, number>;

export type Violation =
  | { kind: "oversized"; path: string; tokens: number }
  | { kind: "grew"; path: string; bytes: number; baselineBytes: number }
  | { kind: "within-limit"; path: string }
  | { kind: "untracked"; path: string };

export function isExemptPath(path: string): boolean {
  return EXEMPT_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

// A NUL byte marks binary content, where a bytes-per-token estimate means
// nothing.
function isBinary(content: Buffer): boolean {
  return content.includes(0);
}

export function estimateTokens(content: Buffer): number {
  return Math.ceil(content.length / BYTES_PER_TOKEN);
}

export function isCountedFile({ path, content }: TrackedFile): boolean {
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

  for (const file of files.filter(isCountedFile)) {
    const { path, content } = file;
    const tokens = estimateTokens(content);
    const baselineBytes = baseline[path];

    if (baselineBytes === undefined) {
      if (tokens > TOKEN_LIMIT) {
        violations.push({ kind: "oversized", path, tokens });
      }
    } else if (tokens <= TOKEN_LIMIT) {
      violations.push({ kind: "within-limit", path });
    } else if (content.length > baselineBytes) {
      violations.push({
        kind: "grew",
        path,
        bytes: content.length,
        baselineBytes,
      });
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

export function buildBaseline(files: readonly TrackedFile[]): Baseline {
  const baseline: Baseline = {};
  for (const file of files.filter(isCountedFile)) {
    if (estimateTokens(file.content) > TOKEN_LIMIT) {
      baseline[file.path] = file.content.length;
    }
  }
  return Object.fromEntries(
    Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)),
  );
}
