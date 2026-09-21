import {
  CATEGORY_ICON_IDS,
  GENERIC_ICON_ID,
} from "@bookkeeping/domain/categories";
import { describe, expect, test } from "vitest";
import { isIconId } from "@/features/categories/icons";

describe("icon catalog", () => {
  test("defines the generic icon that Uncategorized is provisioned with", () => {
    expect(isIconId(GENERIC_ICON_ID)).toBe(true);
  });

  test("keeps the shared icon vocabulary renderable by the web catalog", () => {
    expect(CATEGORY_ICON_IDS.filter((id) => !isIconId(id))).toEqual([]);
  });
});
