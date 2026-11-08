/** The shared defensive bound for tag names. */
export const MAX_TAG_NAME_LENGTH = 40;

/** How many tags one transaction may carry. */
export const MAX_TAGS_PER_TRANSACTION = 5;

/**
 * Surrounding whitespace never counts; inner spacing is kept as typed.
 * Uniqueness also ignores case, the same rule as category names.
 */
export function normalizeTagName(raw: string): string {
  return raw.trim();
}

/** Each named tag once, in a stable order, so equal choices compare and fingerprint alike. */
export function normalizeTagIds(tagIds: readonly string[]): string[] {
  return [...new Set(tagIds)].toSorted((left, right) =>
    left.localeCompare(right),
  );
}

/** Whether two normalized tag sets name the same tags; an absent set is empty. */
export function sameTagIds(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  return (left ?? []).join() === (right ?? []).join();
}

export interface OptionalTagIds {
  tagIds?: string[];
}

/**
 * The tags as a member to spread into a recorded shape: absent when there are
 * none, so untagged records keep the shape they had before tags existed.
 */
export function optionalTagIds(tagIds: readonly string[]): OptionalTagIds {
  return tagIds.length > 0 ? { tagIds: [...tagIds] } : {};
}

/** A tag as a transaction carries it. */
export interface TransactionTag {
  id: string;
  name: string;
}

/** A tag with what entry suggestions are ranked by. */
export interface TagSummary extends TransactionTag {
  /** Current income and expense transactions carrying the tag; refunds never count. */
  transactionCount: number;
  /** When the tag was last put on a current transaction; null when none carries it. */
  lastUsedAt: Date | null;
}
