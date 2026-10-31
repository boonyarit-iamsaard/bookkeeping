const CONTEXT_LINES = 2;

interface DiffLine {
  mark: " " | "-" | "+";
  text: string;
}

// Longest-common-subsequence table: lengths[i][j] is the LCS length of
// expected[i..] and actual[j..]. Schema dumps are a few hundred lines.
function commonLengths(
  expected: readonly string[],
  actual: readonly string[],
): number[][] {
  const lengths = Array.from({ length: expected.length + 1 }, () =>
    new Array<number>(actual.length + 1).fill(0),
  );
  for (let i = expected.length - 1; i >= 0; i -= 1) {
    const row = lengths[i] ?? [];
    const below = lengths[i + 1] ?? [];
    for (let j = actual.length - 1; j >= 0; j -= 1) {
      row[j] =
        expected[i] === actual[j]
          ? (below[j + 1] ?? 0) + 1
          : Math.max(below[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return lengths;
}

function walk(
  expected: readonly string[],
  actual: readonly string[],
): DiffLine[] {
  const lengths = commonLengths(expected, actual);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < expected.length || j < actual.length) {
    const expectedLine = expected[i];
    const actualLine = actual[j];
    if (
      expectedLine !== undefined &&
      actualLine !== undefined &&
      expectedLine === actualLine
    ) {
      lines.push({ mark: " ", text: expectedLine });
      i += 1;
      j += 1;
    } else if (
      actualLine === undefined ||
      (expectedLine !== undefined &&
        (lengths[i + 1]?.[j] ?? 0) >= (lengths[i]?.[j + 1] ?? 0))
    ) {
      lines.push({ mark: "-", text: expectedLine ?? "" });
      i += 1;
    } else {
      lines.push({ mark: "+", text: actualLine });
      j += 1;
    }
  }
  return lines;
}

/**
 * Compares two line lists and returns the differing lines with a little
 * context, `-` for lines only in `expected` and `+` for lines only in
 * `actual`, or `undefined` when they are equal.
 */
export function diffLines(
  expected: readonly string[],
  actual: readonly string[],
): string | undefined {
  const lines = walk(expected, actual);
  const changed = lines.map((line) => line.mark !== " ");
  if (!changed.includes(true)) {
    return undefined;
  }

  const output: string[] = [];
  let lastShown = -1;
  lines.forEach((line, index) => {
    const nearChange = changed
      .slice(Math.max(0, index - CONTEXT_LINES), index + CONTEXT_LINES + 1)
      .includes(true);
    if (!nearChange) {
      return;
    }
    if (lastShown !== -1 && index > lastShown + 1) {
      output.push("...");
    }
    output.push(`${line.mark} ${line.text}`);
    lastShown = index;
  });
  return output.join("\n");
}
