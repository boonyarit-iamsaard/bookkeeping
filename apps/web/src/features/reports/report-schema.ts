import type { CalendarDate } from "@bookkeeping/domain/dates";
import { isReportMonth, parseCalendarDate } from "@bookkeeping/domain/dates";
import { z } from "zod";
import { reportMonthOf } from "./report-month";

const calendarDate = z
  .string()
  .refine(
    (value) => value >= "0001-01-01" && parseCalendarDate(value).ok,
    "Choose a valid date.",
  );

export const reportSchema = z.object({
  month: z.string().refine(isReportMonth),
  asOf: calendarDate,
});

const searchValue = z.preprocess((value) => {
  if (typeof value === "string") {
    return value === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value === undefined ? undefined : "invalid";
}, z.string().optional());

export const reportSearchSchema = z.object({
  month: searchValue,
  asOf: searchValue,
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

export interface ReportValues {
  month: string;
  asOf: string;
}

/** URL values when supplied; otherwise the report defaults for Bangkok today. */
export function reportValues(
  search: Readonly<ReportSearch>,
  today: CalendarDate,
): ReportValues {
  return {
    month: search.month ?? reportMonthOf(today),
    asOf: search.asOf ?? today,
  };
}
