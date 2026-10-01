import type { CategorySummary } from "@bookkeeping/domain/categories";

/**
 * The eight category hues, in the order validated for colour-blind
 * separation; `globals.css` defines each as a token per theme.
 */
export const CATEGORY_HUES = [
  "iris",
  "amber",
  "sky",
  "coral",
  "teal",
  "plum",
  "lime",
  "rose",
] as const;

/** A category hue, or neutral for Uncategorized, transfers and unknown ids. */
export type CategoryColor = (typeof CATEGORY_HUES)[number] | "neutral";

/**
 * FNV-1a over the id, then MurmurHash3's finalizer: the same id always lands
 * on the same hue. FNV's low bits barely mix, and time-ordered ids created
 * together differ only in a few characters, so the finalizer spreads them.
 */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (const character of id) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A lookup from category id to its color, read from the categories list. A
 * parent's hue follows from its own id alone, so adding, removing or
 * reordering categories never recolors another; a child takes its parent's.
 * Uncategorized is the fallback rather than a category, so it stays neutral.
 */
export function createCategoryColors(
  categories: readonly CategorySummary[],
): (categoryId: string) => CategoryColor {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return (categoryId) => {
    const category = byId.get(categoryId);
    const parent =
      category?.parentId == null ? category : byId.get(category.parentId);
    if (!parent || parent.isProtected) {
      return "neutral";
    }
    return CATEGORY_HUES[hashId(parent.id) % CATEGORY_HUES.length];
  };
}
