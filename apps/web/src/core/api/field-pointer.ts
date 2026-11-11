/** A form field a pointer addresses, or `undefined` when the form shows none. */
export type FieldOf<Field extends string = string> = (
  pointer: string,
) => Field | undefined;

/** RFC 6901: the segments after `#/`, with `~1` and `~0` unescaped. */
export function pointerSegments(pointer: string): string[] {
  return pointer
    .replace(/^#?\//, "")
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function startsWith(
  segments: readonly string[],
  prefix: readonly string[],
): boolean {
  return prefix.every((segment, index) => segments[index] === segment);
}

/**
 * Reads a form field back from a field error's pointer. A field is addressed
 * by the request field of its own name, so `#/amount/value` reaches `amount`;
 * a field the request nests deeper names its pointer in `paths`. The field
 * with the longest path the pointer reaches wins, so `#/parent/create/name`
 * reaches `parentName` and any other `#/parent/...` still reaches `parent`.
 */
export function createFieldOf<Field extends string>(
  fields: readonly Field[],
  paths?: Readonly<Partial<Record<Field, string>>>,
): FieldOf<Field> {
  const addressed = fields.map((field) => {
    const path = paths?.[field];
    return { field, segments: path ? pointerSegments(path) : [field] };
  });
  return (pointer) => {
    const segments = pointerSegments(pointer);
    let best: (typeof addressed)[number] | undefined;
    for (const candidate of addressed) {
      if (
        startsWith(segments, candidate.segments) &&
        candidate.segments.length > (best?.segments.length ?? 0)
      ) {
        best = candidate;
      }
    }
    return best?.field;
  };
}
