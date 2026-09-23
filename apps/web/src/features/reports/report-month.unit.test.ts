import { describe, expect, test } from "vitest";
import { reportMonthOf } from "./report-month";

describe("the report month for a Bangkok date", () => {
  test("is the date's calendar month", () => {
    expect(reportMonthOf("2026-09-23")).toBe("2026-09");
  });

  test("keeps the date's month on its last day", () => {
    expect(reportMonthOf("2026-12-31")).toBe("2026-12");
  });
});
