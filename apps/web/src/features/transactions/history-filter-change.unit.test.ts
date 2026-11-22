import { describe, expect, test } from "vitest";
import { changeHistoryFilter, toggleHistoryTag } from "./history-filter-change";

const COFFEE = "00000000-0000-4000-8000-000000000003";
const SNACKS = "00000000-0000-4000-8000-000000000004";

describe("changing one history filter", () => {
  test("sets the value and keeps the other filters", () => {
    expect(
      changeHistoryFilter(
        { type: "expense", tagId: [COFFEE] },
        { key: "from", value: "2026-09-01" },
      ),
    ).toEqual({ type: "expense", tagId: [COFFEE], from: "2026-09-01" });
  });

  test("an empty value lifts just that filter", () => {
    expect(
      changeHistoryFilter(
        { type: "expense", from: "2026-09-01" },
        { key: "type", value: "" },
      ),
    ).toEqual({ from: "2026-09-01" });
  });
});

describe("toggling a tag", () => {
  test("adds a tag not yet chosen, after those that are", () => {
    expect(toggleHistoryTag({ tagId: [COFFEE] }, SNACKS)).toEqual({
      tagId: [COFFEE, SNACKS],
    });
  });

  test("removing the last chosen tag drops the filter", () => {
    expect(
      toggleHistoryTag({ type: "expense", tagId: [COFFEE] }, COFFEE),
    ).toEqual({ type: "expense" });
  });
});
