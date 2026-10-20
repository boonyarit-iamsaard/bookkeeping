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

export interface StagedFile {
  path: string;
  content: Buffer;
}

export interface OversizedFile {
  path: string;
  tokens: number;
}

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

export function findOversizedFiles(
  files: readonly StagedFile[],
): OversizedFile[] {
  return files
    .filter(({ path, content }) => !isExemptPath(path) && !isBinary(content))
    .map(({ path, content }) => ({ path, tokens: estimateTokens(content) }))
    .filter(({ tokens }) => tokens > TOKEN_LIMIT);
}
