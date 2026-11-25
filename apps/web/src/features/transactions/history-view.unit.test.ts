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
        page: "1",
        pageSize: "50",
        sort: "date",
        order: "desc",
      },
    });
  });

  test("the numbered page keeps the address's page, size, sort and order", () => {
    const view = buildHistoryView({
      type: "income",
      page: 3,
      pageSize: 10,
      sort: "amount",
      order: "asc",
    });
    expect(view).toMatchObject({
      state: "valid",
      values: { type: "income" },
      list: {
        type: "income",
        page: "3",
        pageSize: "10",
        sort: "amount",
        order: "asc",
      },
    });
  });

  test("invalid filters read nothing and name each malformed field", () => {
    const view = buildHistoryView({
      from: "bogus",
      walletId: "gone",
      type: "7",
      categoryId: "not-a-uuid",
      page: 2,
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

  test("the page, sort, saved id, and deletion flag are not filters", () => {
    expect(
      buildHistoryView({
        page: 2,
        sort: "amount",
        created: CASH,
        deleted: 1,
      }),
    ).toEqual({
      state: "valid",
      values: {},
      hasFilters: false,
      list: { page: "2", pageSize: "50", sort: "amount", order: "desc" },
    });
  });
});
