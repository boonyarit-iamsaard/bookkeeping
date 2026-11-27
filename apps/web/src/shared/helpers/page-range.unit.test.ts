import { describe, expect, test } from "vitest";
import { pageRangeLabel } from "./page-range";

describe("page range label", () => {
  test("one page reads just the count", () => {
    expect(
      pageRangeLabel(
        { pageIndex: 0, pageSize: 10 },
        { rowCount: 7, rowCountLabel: "7 rows" },
      ),
    ).toBe("7 rows");
    expect(
      pageRangeLabel(
        { pageIndex: 0, pageSize: 10 },
        { rowCount: 10, rowCountLabel: "10 rows" },
      ),
    ).toBe("10 rows");
  });

  test("past one page it names the rows shown", () => {
    expect(
      pageRangeLabel(
        { pageIndex: 1, pageSize: 10 },
        { rowCount: 129, rowCountLabel: "129 rows" },
      ),
    ).toBe("11–20 of 129 rows");
    expect(
      pageRangeLabel(
        { pageIndex: 12, pageSize: 10 },
        { rowCount: 129, rowCountLabel: "129 rows" },
      ),
    ).toBe("121–129 of 129 rows");
  });
});
