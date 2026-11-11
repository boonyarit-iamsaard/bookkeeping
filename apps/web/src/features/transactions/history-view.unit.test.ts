import { describe, expect, test } from "vitest";
import { historySearchSchema } from "./history-schema";
import { buildHistoryView } from "./history-view";

const CASH = "00000000-0000-4000-8000-000000000001";
const COFFEE = "00000000-0000-4000-8000-000000000003";

describe("history view", () => {
  test("valid filters read the page the address names", () => {
    expect(
      buildHistoryView({
        from: "2026-09-01",
        to: "2026-09-30",
        walletId: CASH,
        type: "expense",
        tagId: [COFFEE],
        cursor: "eyJ2IjoxfQ",
      }),
    ).toEqual({
      state: "valid",
      values: {
        from: "2026-09-01",
        to: "2026-09-30",
        walletId: CASH,
        type: "expense",
        tagId: [COFFEE],
      },
      hasFilters: true,
      list: {
        from: "2026-09-01",
        to: "2026-09-30",
        walletId: CASH,
        type: "expense",
        tagId: [COFFEE],
        cursor: "eyJ2IjoxfQ",
      },
    });
  });

  test("invalid filters read nothing and name each malformed field", () => {
    const view = buildHistoryView({
      from: "bogus",
      walletId: "gone",
      type: "7",
      categoryId: "not-a-uuid",
      cursor: "eyJ2IjoxfQ",
    });
    expect(view).not.toHaveProperty("list");
    expect(view).toMatchObject({
      state: "invalid",
      values: {
        from: "bogus",
        walletId: "gone",
        type: "7",
        categoryId: "not-a-uuid",
      },
      hasFilters: true,
      errors: [
        "Choose a valid From date.",
        "Choose a valid wallet.",
        "Choose a valid category.",
        "Choose a valid type.",
      ],
    });
    expect(view.state === "invalid" && [...view.invalidKeys]).toEqual([
      "from",
      "walletId",
      "categoryId",
      "type",
    ]);
  });

  test("a reversed date range names the order but marks neither date", () => {
    const view = buildHistoryView({ from: "2026-09-03", to: "2026-09-01" });
    expect(view).toMatchObject({
      state: "invalid",
      errors: ["From date must be on or before To date."],
    });
    expect(view.state === "invalid" && view.invalidKeys.size).toBe(0);
  });

  test("marks only the chosen tag the history does not accept", () => {
    const view = buildHistoryView({ tagId: [COFFEE, "gone"] });
    expect(view).toMatchObject({
      state: "invalid",
      errors: ["Choose tags from the list."],
    });
    expect(view.state === "invalid" && [...view.invalidKeys]).toEqual([
      "tagId:gone",
    ]);
  });

  test("a repeated single-choice parameter is an invalid filter", () => {
    const view = buildHistoryView(
      historySearchSchema.parse({ from: ["2026-09-01", "2026-09-02"] }),
    );
    expect(view).toMatchObject({ state: "invalid", hasFilters: true });
    expect(view.state === "invalid" && [...view.invalidKeys]).toEqual(["from"]);
  });

  test("the cursor, saved id, and deletion flag are not filters", () => {
    expect(
      buildHistoryView({ cursor: "eyJ2IjoxfQ", created: CASH, deleted: 1 }),
    ).toEqual({
      state: "valid",
      values: {},
      hasFilters: false,
      list: { cursor: "eyJ2IjoxfQ" },
    });
  });
});
