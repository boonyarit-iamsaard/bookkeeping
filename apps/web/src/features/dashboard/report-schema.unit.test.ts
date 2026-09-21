import { describe, expect, test } from "vitest";
import {
  reportSchema,
  reportSearchSchema,
  reportValues,
} from "./report-schema";

describe("dashboard report filters", () => {
  test("default missing filters to the current Bangkok month and date", () => {
    const search = reportSearchSchema.parse({});

    expect(reportValues(search, "2026-09-21")).toEqual({
      month: "2026-09",
      asOf: "2026-09-21",
    });
  });

  test("keep valid URL filters as the report query", () => {
    const search = reportSearchSchema.parse({
      month: "2026-08",
      asOf: "2026-08-31",
    });
    const values = reportValues(search, "2026-09-21");

    expect(reportSchema.parse(values)).toEqual({
      month: "2026-08",
      asOf: "2026-08-31",
    });
  });

  test("retain malformed URL filters for editable invalid controls", () => {
    const search = reportSearchSchema.parse({
      month: "not-a-month",
      asOf: "2026-02-30",
    });
    const values = reportValues(search, "2026-09-21");

    expect(values).toEqual({
      month: "not-a-month",
      asOf: "2026-02-30",
    });
    expect(reportSchema.safeParse(values).success).toBe(false);
  });

  test("keep repeated URL filters invalid instead of treating them as missing", () => {
    const search = reportSearchSchema.parse({
      month: ["2026-08", "2026-09"],
      asOf: ["2026-09-02", "2026-09-03"],
    });
    const values = reportValues(search, "2026-09-21");

    expect(values).not.toEqual({
      month: "2026-09",
      asOf: "2026-09-21",
    });
    expect(reportSchema.safeParse(values).success).toBe(false);
  });
});
