import { describe, expect, test } from "vitest";
import {
  addDays,
  formatCalendarDate,
  formatInstant,
  parseCalendarDate,
  todayIn,
} from "./dates";

describe("todayIn", () => {
  test("rolls to the next calendar day at Bangkok midnight, not UTC", () => {
    const timeZone = "Asia/Bangkok";
    expect(todayIn({ timeZone, now: new Date("2026-09-12T16:59:59Z") })).toBe(
      "2026-09-12",
    );
    expect(todayIn({ timeZone, now: new Date("2026-09-12T17:00:00Z") })).toBe(
      "2026-09-13",
    );
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

describe("addDays", () => {
  test("crosses month and year boundaries in date-only arithmetic", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formatInstant", () => {
  test("shows the recording time in Bangkok hours and minutes", () => {
    expect(
      formatInstant({
        instant: new Date("2026-09-12T17:05:00Z"),
        timeZone: "Asia/Bangkok",
      }),
    ).toBe("13 Sep 2026, 00:05");
    expect(
      formatInstant({
        instant: new Date("2026-09-13T07:32:10Z"),
        timeZone: "Asia/Bangkok",
      }),
    ).toBe("13 Sep 2026, 14:32");
  });
});
