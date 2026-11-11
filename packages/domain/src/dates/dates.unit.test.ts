import { describe, expect, test } from "vitest";
import {
  addDays,
  earlierOf,
  formatCalendarDate,
  formatInstant,
  isCalendarDate,
  isReportMonth,
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

describe("isCalendarDate", () => {
  test("accepts real calendar dates from year 1 onward", () => {
    expect(isCalendarDate("2026-09-01")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("0001-01-01")).toBe(true);
  });

  test("rejects year zero, impossible dates, and malformed strings", () => {
    for (const value of [
      "0000-12-31",
      "2026-02-29",
      "2026-13-01",
      "",
      "2026-9-1",
      "09/13/2026",
      " 2026-09-01",
    ]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });
});

describe("isReportMonth", () => {
  test("accepts real calendar months from year 1 onward", () => {
    expect(isReportMonth("2026-09")).toBe(true);
    expect(isReportMonth("2026-01")).toBe(true);
    expect(isReportMonth("2026-12")).toBe(true);
    expect(isReportMonth("0001-01")).toBe(true);
    expect(isReportMonth("9999-12")).toBe(true);
  });

  test("rejects month 00 and month 13", () => {
    expect(isReportMonth("2026-00")).toBe(false);
    expect(isReportMonth("2026-13")).toBe(false);
  });

  test("rejects months before year 1", () => {
    expect(isReportMonth("0000-12")).toBe(false);
    expect(isReportMonth("0000-01")).toBe(false);
  });

  test("rejects malformed strings", () => {
    for (const value of [
      "",
      "2026",
      "2026-9",
      "26-09",
      "2026/09",
      "2026-09-01",
      " 2026-09",
      "2026-09 ",
      "abcd-ef",
    ]) {
      expect(isReportMonth(value)).toBe(false);
    }
  });
});

describe("addDays", () => {
  test("crosses month and year boundaries in date-only arithmetic", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("earlierOf", () => {
  test("names the earlier date whichever argument holds it", () => {
    expect(earlierOf("2026-09-01", "2026-09-30")).toBe("2026-09-01");
    expect(earlierOf("2026-09-30", "2026-09-01")).toBe("2026-09-01");
  });

  test("returns the date itself when both are equal", () => {
    expect(earlierOf("2026-09-13", "2026-09-13")).toBe("2026-09-13");
  });

  test("orders across month and year boundaries", () => {
    expect(earlierOf("2026-10-01", "2026-09-30")).toBe("2026-09-30");
    expect(earlierOf("2027-01-01", "2026-12-31")).toBe("2026-12-31");
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
