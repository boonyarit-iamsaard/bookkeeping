import type { Result } from "@/shared/helpers/result";
import { err, ok } from "@/shared/helpers/result";

/** A calendar date in ISO form, YYYY-MM-DD, with no time or zone. */
export type CalendarDate = string;

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

const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date as the user in Thailand experiences it. */
export function todayInBangkok(now: Date = new Date()): CalendarDate {
  return isoDateFormatter.format(now);
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
  function part(type: Intl.DateTimeFormatPartTypes) {
    return parts.find((candidate) => candidate.type === type)?.value ?? "";
  }
  return `${part("day")} ${part("month")} ${part("year")}`;
}
