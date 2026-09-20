import { DEFAULT_CATEGORIES } from "@bookkeeping/application/categories/defaults";
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

  test("covers every icon the default category set is provisioned with", () => {
    const iconIds = Object.values(DEFAULT_CATEGORIES).flatMap((tree) =>
      tree.flatMap((parent) => [
        parent.iconId,
        ...(parent.children ?? []).map((child) => child.iconId),
      ]),
    );

    expect(iconIds.filter((id) => !isIconId(id))).toEqual([]);
  });

  test("keeps the shared icon vocabulary renderable by the web catalog", () => {
    expect(CATEGORY_ICON_IDS.filter((id) => !isIconId(id))).toEqual([]);
  });
});
