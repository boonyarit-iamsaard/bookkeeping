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
