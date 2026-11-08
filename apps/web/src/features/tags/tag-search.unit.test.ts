import { describe, expect, test } from "vitest";
import type { TagSummary } from "@/features/tags/tag-search";
import {
  sameTagName,
  searchTags,
  tagUsageLabel,
} from "@/features/tags/tag-search";

function tag(name: string, transactionCount = 0): TagSummary {
  return { id: `id-${name}`, name, transactionCount, lastUsedAt: null };
}

// Suggestion order as the API sends it: recent and most used first.
const TAGS = [tag("Coffee", 12), tag("7-11", 8), tag("Café Amazon", 2)];

describe("searchTags", () => {
  test("offers every tag in suggestion order for an empty query", () => {
    expect(searchTags(TAGS, "  ").matches).toEqual(TAGS);
    expect(searchTags(TAGS, "").exactMatch).toBeUndefined();
  });

  test("narrows by contained text, ignoring case and accents, keeping the order", () => {
    expect(searchTags(TAGS, "CAF").matches.map((match) => match.name)).toEqual([
      "Café Amazon",
    ]);
    expect(searchTags(TAGS, "fe").matches.map((match) => match.name)).toEqual([
      "Coffee",
      "Café Amazon",
    ]);
  });

  test("finds the tag that already holds a name under the uniqueness rule", () => {
    expect(searchTags(TAGS, "  coffee ").exactMatch?.name).toBe("Coffee");
    expect(searchTags(TAGS, "Coff").exactMatch).toBeUndefined();
  });
});

describe("sameTagName", () => {
  test("ignores surrounding whitespace and case but not inner spacing", () => {
    expect(sameTagName(" 7-11 ", "7-11")).toBe(true);
    expect(sameTagName("Hay Day", "hay day")).toBe(true);
    expect(sameTagName("Hay Day", "HayDay")).toBe(false);
  });
});

describe("tagUsageLabel", () => {
  test("counts the transactions carrying a tag", () => {
    expect(tagUsageLabel(0)).toBe("Not on any transaction");
    expect(tagUsageLabel(1)).toBe("1 transaction");
    expect(tagUsageLabel(12)).toBe("12 transactions");
  });
});
