import type { CalendarDate } from "@bookkeeping/domain/dates";

/** The month the report counts a Bangkok calendar date in, as YYYY-MM. */
export function reportMonthOf(date: CalendarDate): string {
  return date.slice(0, 7);
}

function formatMonth(
  month: string,
  options: Readonly<Intl.DateTimeFormatOptions>,
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** A report month as its heading names it, such as "September 2026". */
export function formatReportMonth(month: string): string {
  return formatMonth(month, { month: "long", year: "numeric" });
}

/** A report month as a chart axis names it, such as "Sep". */
export function formatReportMonthShort(month: string): string {
  return formatMonth(month, { month: "short" });
}
