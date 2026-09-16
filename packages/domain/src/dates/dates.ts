import type { Result } from "../result/result";
import { err, ok } from "../result/result";

/** A calendar date in ISO form, YYYY-MM-DD, with no time or zone. */
export type CalendarDate = string; // NOSONAR

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts only well-formed, real calendar dates ("2026-02-30" is rejected). */
export function parseCalendarDate(
  value: string,
): Result<CalendarDate, "invalid"> {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return err("invalid");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    !parsed.toISOString().startsWith(value)
  ) {
    return err("invalid");
  }
  return ok(value);
}

function partOf(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

export type TimeZone = "Asia/Bangkok";

/** The one zone the product reads dates and times in (Thailand, no DST). */
export const APP_TIME_ZONE: TimeZone = "Asia/Bangkok";

interface TodayInput {
  timeZone: TimeZone;
  /** The instant to read; defaults to the current moment. */
  now?: Date;
}

// Locale-neutral: the parts are reassembled into ISO form, so no locale's
// incidental date pattern is relied on.
const calendarDateFormatters: Record<TimeZone, Intl.DateTimeFormat> = {
  "Asia/Bangkok": new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }),
};

/** The calendar date it currently is in the given zone. */
export function todayIn({
  timeZone,
  now = new Date(),
}: Readonly<TodayInput>): CalendarDate {
  const parts = calendarDateFormatters[timeZone].formatToParts(now);
  return `${partOf(parts, "year")}-${partOf(parts, "month")}-${partOf(parts, "day")}`;
}

// en-US keeps three-letter months ("Sep"); en-GB has switched to "Sept".
const readingFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-09-01" → "1 Sep 2026". */
export function formatCalendarDate(date: CalendarDate): string {
  const parts = readingFormatter.formatToParts(new Date(`${date}T00:00:00Z`));
  return `${partOf(parts, "day")} ${partOf(parts, "month")} ${partOf(parts, "year")}`;
}

/** The calendar date `days` before or after `date`, staying in date-only arithmetic. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

interface InstantInput {
  instant: Date;
  timeZone: TimeZone;
}

// Explicit like `currency` on the money helpers, so a displayed time is never
// ambiguous about the zone it was read in.
const instantFormatters: Record<TimeZone, Intl.DateTimeFormat> = {
  "Asia/Bangkok": new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }),
};

/** An instant as read in the given zone: "13 Sep 2026, 14:32". */
export function formatInstant({
  instant,
  timeZone,
}: Readonly<InstantInput>): string {
  const parts = instantFormatters[timeZone].formatToParts(instant);
  return `${partOf(parts, "day")} ${partOf(parts, "month")} ${partOf(parts, "year")}, ${partOf(parts, "hour")}:${partOf(parts, "minute")}`;
}
