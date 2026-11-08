import { normalizeTagName } from "@bookkeeping/domain/tags";
import type { components } from "@/core/api/openapi.gen";

export type TagSummary = components["schemas"]["TagSummary"];

export interface TagSearchResult {
  /** The tags whose names contain the query, still in suggestion order. */
  matches: readonly TagSummary[];
  /** The tag already holding exactly this name under the uniqueness rule. */
  exactMatch: TagSummary | undefined;
}

/** Forgiving for search: trimmed, case-folded, diacritics stripped. */
function foldName(text: string): string {
  return normalizeTagName(text)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** The uniqueness rule exactly as the server applies it: trim, then case. */
export function sameTagName(a: string, b: string): boolean {
  return (
    normalizeTagName(a).toLowerCase() === normalizeTagName(b).toLowerCase()
  );
}

/**
 * The tags matching a query. The API already ranks them most recent and most
 * used first, so narrowing keeps that order; an empty query is every tag.
 */
export function searchTags(
  tags: readonly TagSummary[],
  query: string,
): TagSearchResult {
  const needle = foldName(query);
  return {
    matches: needle
      ? tags.filter((tag) => foldName(tag.name).includes(needle))
      : tags,
    exactMatch: needle
      ? tags.find((tag) => sameTagName(tag.name, query))
      : undefined,
  };
}

/** "12 transactions", "1 transaction", "Not on any transaction". */
export function tagUsageLabel(count: number): string {
  if (count === 0) {
    return "Not on any transaction";
  }
  return count === 1 ? "1 transaction" : `${count} transactions`;
}
