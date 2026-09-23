import type { CalendarDate } from "@bookkeeping/domain/dates";

/** The month the report counts a Bangkok calendar date in, as YYYY-MM. */
export function reportMonthOf(date: CalendarDate): string {
  return date.slice(0, 7);
}
