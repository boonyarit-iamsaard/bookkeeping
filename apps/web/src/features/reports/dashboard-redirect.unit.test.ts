import { describe, expect, test } from "vitest";
import { dashboardRedirectHref } from "./dashboard-redirect";

describe("the old dashboard address", () => {
  test("lands on Reports with its month and balance date", () => {
    expect(dashboardRedirectHref("?month=2026-08&asOf=2026-08-31")).toBe(
      "/reports?month=2026-08&asOf=2026-08-31",
    );
  });

  test("lands on Reports' defaults without a query", () => {
    expect(dashboardRedirectHref("")).toBe("/reports");
  });

  test("keeps malformed and repeated values for Reports to show as invalid", () => {
    expect(
      dashboardRedirectHref(
        "?month=not-a-month&asOf=2026-09-02&asOf=2026-09-03",
      ),
    ).toBe("/reports?month=not-a-month&asOf=2026-09-02&asOf=2026-09-03");
  });
});
