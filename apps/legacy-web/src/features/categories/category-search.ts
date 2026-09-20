import type {
  CategoryKind,
  CategorySummary,
} from "@bookkeeping/domain/categories";

export interface CategoryGroup {
  parent: CategorySummary;
  /** True when the parent itself matched, so all its children are shown. */
  parentMatches: boolean;
  children: readonly CategorySummary[];
}

export interface CategorySearchResult {
  groups: readonly CategoryGroup[];
  /** A category already carries exactly this name (trimmed, case-folded). */
  exactMatch: boolean;
}

interface SearchCategoriesOptions {
  categories: readonly CategorySummary[];
  kind: CategoryKind;
  query: string;
}

/** Trimmed, lowercased, diacritics stripped: forgiving matching for search. */
function foldName(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** The uniqueness rule exactly as the server applies it: trim, then case. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Parents that may take children: this tree's top level minus Uncategorized. */
export function topLevelParents(
  categories: readonly CategorySummary[],
  kind: CategoryKind,
): readonly CategorySummary[] {
  return categories.filter(
    (category) =>
      category.kind === kind &&
      category.parentId === null &&
      !category.isProtected,
  );
}

/**
 * Both levels of one tree, grouped under parents. A matching parent brings
 * every child; a matching child brings its parent as the group heading,
 * which stays selectable. An empty query is the whole tree.
 */
export function searchCategories({
  categories,
  kind,
  query,
}: Readonly<SearchCategoriesOptions>): CategorySearchResult {
  const needle = foldName(query);
  const tree = categories.filter((category) => category.kind === kind);
  const parents = tree.filter((category) => category.parentId === null);
  const groups: CategoryGroup[] = [];
  let exactMatch = false;
  for (const parent of parents) {
    const children = tree.filter((category) => category.parentId === parent.id);
    const parentMatches =
      needle.length > 0 && foldName(parent.name).includes(needle);
    const matchingChildren =
      needle.length === 0 || parentMatches
        ? children
        : children.filter((child) => foldName(child.name).includes(needle));
    if (needle.length > 0) {
      exactMatch ||=
        sameName(parent.name, query) ||
        children.some((child) => sameName(child.name, query));
    }
    if (needle.length === 0 || parentMatches || matchingChildren.length > 0) {
      groups.push({ parent, parentMatches, children: matchingChildren });
    }
  }
  return { groups, exactMatch };
}

/** "Food & Drink › Groceries" for a child, the bare name for a parent. */
export function categoryPath(
  category: Readonly<CategorySummary>,
  categories: readonly CategorySummary[],
): string {
  if (category.parentId === null) {
    return category.name;
  }
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

interface CategoryLabelInput {
  name: string;
  parentName: string | null;
}

/** "Food & Drink › Groceries" for a child, the bare name for a parent. */
export function categoryLabel(category: Readonly<CategoryLabelInput>): string {
  return category.parentName
    ? `${category.parentName} › ${category.name}`
    : category.name;
}
