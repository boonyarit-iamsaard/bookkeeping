import type { CalendarDate } from "@bookkeeping/domain/dates";
import { isCalendarDate, isReportMonth } from "@bookkeeping/domain/dates";
import { z } from "zod";
import { searchValue } from "@/shared/helpers/search-value";
import { reportMonthOf } from "./report-month";

export const reportSchema = z.object({
  month: z.string().refine(isReportMonth),
  asOf: z.string().refine(isCalendarDate, "Choose a valid date."),
});

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
