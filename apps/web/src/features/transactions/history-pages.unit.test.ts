import { describe, expect, test } from "vitest";
import {
  changeHistoryTable,
  changeHistoryType,
  historyTableSettings,
  lastHistoryPage,
  olderHistoryPage,
} from "./history-pages";

const CASH = "00000000-0000-4000-8000-000000000001";

describe("history pages", () => {
  test("moving page keeps the filters, sort and rows per page", () => {
    expect(
      changeHistoryTable(
        { walletId: CASH, page: 2, pageSize: 10, sort: "amount" },
        { page: 3 },
      ),
    ).toEqual({ walletId: CASH, page: 3, pageSize: 10, sort: "amount" });
  });

  test("the first page leaves the page out of the address", () => {
    expect(changeHistoryTable({ page: 4, order: "asc" }, { page: 1 })).toEqual({
      order: "asc",
    });
  });

  test("a new sort, order or rows per page returns to the first page", () => {
    expect(
      changeHistoryTable(
        { type: "expense", page: 3, pageSize: 25 },
        { sort: "amount", order: "desc" },
      ),
    ).toEqual({ type: "expense", pageSize: 25, sort: "amount", order: "desc" });
    expect(
      changeHistoryTable({ page: 3, sort: "amount" }, { pageSize: 100 }),
    ).toEqual({ sort: "amount", pageSize: 100 });
  });

  test("a table change lets go of the saved highlight and deletion notice", () => {
    expect(
      changeHistoryTable({ created: CASH, deleted: 1 }, { page: 2 }),
    ).toEqual({ page: 2 });
  });

  test("a filter change keeps the sort and rows per page but not the page", () => {
    expect(
      historyTableSettings({
        walletId: CASH,
        page: 3,
        pageSize: 10,
        sort: "amount",
        order: "asc",
        created: CASH,
      }),
    ).toEqual({ pageSize: 10, sort: "amount", order: "asc" });
    expect(historyTableSettings({ page: 2 })).toEqual({});
  });

  test("a type tab keeps the other filters and the view but returns to page 1", () => {
    expect(
      changeHistoryType(
        { walletId: CASH, type: "income", page: 3, sort: "amount" },
        "expense",
      ),
    ).toEqual({ walletId: CASH, type: "expense", sort: "amount" });
  });

  test("the All tab lifts the type filter", () => {
    expect(changeHistoryType({ type: "refund", page: 2 }, undefined)).toEqual(
      {},
    );
  });

  test("older transactions are the next page until the last one", () => {
    expect(olderHistoryPage({}, 51)).toBe(2);
    expect(olderHistoryPage({}, 50)).toBeUndefined();
    expect(olderHistoryPage({ page: 2, pageSize: 10 }, 21)).toBe(3);
    expect(olderHistoryPage({ page: 3, pageSize: 10 }, 21)).toBeUndefined();
    expect(olderHistoryPage({ page: 9 }, 0)).toBeUndefined();
  });

  test("a page past the end names the last one to return to", () => {
    expect(lastHistoryPage({ page: 3 }, 51)).toBe(2);
    expect(lastHistoryPage({ page: 4, pageSize: 10 }, 21)).toBe(3);
    expect(lastHistoryPage({ page: 2 }, 51)).toBeUndefined();
    expect(lastHistoryPage({}, 51)).toBeUndefined();
  });

  test("returns to page one from an old address when no transactions match", () => {
    expect(lastHistoryPage({ page: 9 }, 0)).toBe(1);
    expect(lastHistoryPage({ page: 1 }, 0)).toBeUndefined();
  });
});
