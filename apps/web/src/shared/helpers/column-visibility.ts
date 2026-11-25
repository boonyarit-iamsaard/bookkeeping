import { z } from "zod";

/** What a browser remembers: shown or hidden per column id. */
const storedVisibilitySchema = z.record(z.string(), z.boolean()).catch({});

export interface ColumnDefaults {
  id: string;
  /** The owner may hide it. */
  hideable: boolean;
  /** Hidden until the owner shows it. */
  hiddenByDefault: boolean;
}

function parseStored(stored: string | null) {
  try {
    return storedVisibilitySchema.parse(JSON.parse(stored ?? "{}"));
  } catch {
    return {};
  }
}

/**
 * The columns this browser last chose for one table. A stored value for a
 * column that may not hide is ignored, so a tampered entry never hides it.
 */
export function readColumnVisibility(
  stored: string | null,
  columns: readonly ColumnDefaults[],
): Record<string, boolean> {
  const parsed = parseStored(stored);
  return Object.fromEntries(
    columns.map(({ id, hideable, hiddenByDefault }) => [
      id,
      hideable ? (parsed[id] ?? !hiddenByDefault) : true,
    ]),
  );
}
