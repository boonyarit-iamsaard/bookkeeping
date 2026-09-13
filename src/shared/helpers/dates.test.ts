import { describe, expect, test } from "vitest";
import {
  formatCalendarDate,
  parseCalendarDate,
  todayInBangkok,
} from "@/shared/helpers/dates";

describe("todayInBangkok", () => {
  test("rolls to the next calendar day at Bangkok midnight, not UTC", () => {
    expect(todayInBangkok(new Date("2026-09-12T16:59:59Z"))).toBe("2026-09-12");
    expect(todayInBangkok(new Date("2026-09-12T17:00:00Z"))).toBe("2026-09-13");
  });
});

describe("formatCalendarDate", () => {
  test("shows a calendar date in the app's reading form", () => {
    expect(formatCalendarDate("2026-09-01")).toBe("1 Sep 2026");
  });
});

describe("parseCalendarDate", () => {
  test("accepts real dates and rejects impossible or malformed ones", () => {
    expect(parseCalendarDate("2026-09-01")).toEqual({
      ok: true,
      value: "2026-09-01",
    });
    expect(parseCalendarDate("2026-02-30")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(parseCalendarDate("09/13/2026")).toEqual({
      ok: false,
      error: "invalid",
    });
  });
});
