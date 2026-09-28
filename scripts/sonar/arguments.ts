/** The arguments after the script, without the `--` pnpm may forward first. */
export function scriptArguments(): string[] {
  const [first, ...rest] = process.argv.slice(2);
  if (first === undefined) {
    return [];
  }
  return first === "--" ? rest : [first, ...rest];
}

/** An error and its causes, since `fetch failed` hides the network error. */
export function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  return error.cause === undefined
    ? error.message
    : `${error.message} (${formatError(error.cause)})`;
}
