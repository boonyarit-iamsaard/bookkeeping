import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FinancialReportProps } from "@/features/reports/components/report-sections";
import { reportMonthOf } from "@/features/reports/report-month";
import { useReportView } from "@/features/reports/report-reads";
import type { ReportSearch } from "@/features/reports/report-schema";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";
import { useToday } from "@/shared/hooks/use-today";

interface UseReportsOptions {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

export function useReports({
  search,
  initialToday,
}: Readonly<UseReportsOptions>) {
  const today = useToday(initialToday);
  const thisMonth = reportMonthOf(today);
  const [comparedWalletId, setComparedWalletId] = useState<string>();
  const report = useReportView({ search, today, comparedWalletId });
  const navigate = useNavigate({ from: "/reports" });

  // Each control applies on pick and changes only its own value; the other
  // keeps the address's, so a malformed one stays visible until corrected.
  // The latest address, not the report on show: a pick made while the other
  // control's report loads would otherwise undo that control's pick.
  function showMonth(month: string) {
    void navigate({ search: (latest) => ({ month, asOf: latest.asOf }) });
  }

  function showBalanceDate(asOf: CalendarDate) {
    void navigate({ search: (latest) => ({ month: latest.month, asOf }) });
  }

  // It sits with the balances it dates; an invalid value keeps it on screen
  // above the notice, so the value to correct stays visible.
  const balanceDate = (
    <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <label htmlFor="balance-date">Balance date</label>
      <DatePicker
        key={report.values.asOf}
        id="balance-date"
        today={today}
        max={today}
        defaultValue={report.values.asOf}
        invalid={report.invalidFields.has("asOf")}
        onChange={showBalanceDate}
      />
    </div>
  );

  const reportMonth = (
    <>
      <label htmlFor="report-month" className="sr-only">
        Report month
      </label>
      <MonthPicker
        key={report.values.month}
        id="report-month"
        thisMonth={thisMonth}
        max={thisMonth}
        defaultValue={report.values.month}
        invalid={report.invalidFields.has("month")}
        onChange={showMonth}
        className="w-auto"
      />
    </>
  );

  const sections =
    report.state === "ready"
      ? ({
          summary: report.summary,
          categoryBreakdown: report.categoryBreakdown,
          balanceTrend: report.balanceTrend,
          comparedWalletId,
          onCompareWallet: setComparedWalletId,
          currentWallets: report.currentWallets,
          currentTotal: report.currentTotal,
          datedWallets: report.datedWallets,
          datedTotal: report.datedTotal,
          asOf: report.values.asOf,
          balanceDate,
          trend: report.trend,
        } satisfies FinancialReportProps)
      : undefined;

  return { state: report.state, sections, reportMonth, balanceDate };
}
