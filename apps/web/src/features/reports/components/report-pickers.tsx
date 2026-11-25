import type { CalendarDate } from "@bookkeeping/domain/dates";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";

export interface BalanceDateFieldProps {
  today: CalendarDate;
  value: CalendarDate;
  invalid: boolean;
  onChange: (asOf: CalendarDate) => void;
}

/**
 * It sits with the balances it dates; an invalid value keeps it on screen
 * above the notice, so the value to correct stays visible.
 */
export function BalanceDateField({
  today,
  value,
  invalid,
  onChange,
}: Readonly<BalanceDateFieldProps>) {
  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <label htmlFor="balance-date">Balance date</label>
      <DatePicker
        key={value}
        id="balance-date"
        today={today}
        max={today}
        defaultValue={value}
        invalid={invalid}
        onChange={onChange}
      />
    </div>
  );
}

export interface ReportMonthFieldProps {
  thisMonth: string;
  value: string;
  invalid: boolean;
  onChange: (month: string) => void;
}

/** The report's month, in the title bar. */
export function ReportMonthField({
  thisMonth,
  value,
  invalid,
  onChange,
}: Readonly<ReportMonthFieldProps>) {
  return (
    <>
      <label htmlFor="report-month" className="sr-only">
        Report month
      </label>
      <MonthPicker
        key={value}
        id="report-month"
        thisMonth={thisMonth}
        max={thisMonth}
        defaultValue={value}
        invalid={invalid}
        onChange={onChange}
        className="w-auto"
      />
    </>
  );
}
