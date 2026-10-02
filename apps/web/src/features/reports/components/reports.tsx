import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";
import { reportMonthOf } from "../report-month";
import { useReportReads } from "../report-reads";
import type { ReportSearch } from "../report-schema";
import { FinancialReport } from "./financial-report";
import { ReportsLoading } from "./reports-loading";

interface ReportsProps {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

export function Reports({ search, initialToday }: Readonly<ReportsProps>) {
  const today = useBangkokToday(initialToday);
  const thisMonth = reportMonthOf(today);
  const [comparedWalletId, setComparedWalletId] = useState<string>();
  const report = useReportReads({ search, today, comparedWalletId });
  const navigate = useNavigate({ from: "/reports" });

  if (report.state === "loading") {
    return <ReportsLoading />;
  }

  // Each control applies on pick and changes only its own value; the other
  // keeps the address's, so a malformed one stays visible until corrected.
  function showMonth(month: string) {
    void navigate({ search: { month, asOf: search.asOf } });
  }

  function showBalanceDate(asOf: CalendarDate) {
    void navigate({ search: { month: search.month, asOf } });
  }

  // It sits with the balances it dates; an invalid value keeps it on screen
  // above the notice, so the value to correct stays visible.
  const balanceDate = (
    <div className="flex min-w-0 flex-col gap-2 font-medium text-sm">
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

  return (
    <Page layout="wide">
      <TitleBar
        title="Reports"
        actions={
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
        }
      />
      {report.state === "ready" ? (
        <FinancialReport
          summary={report.summary}
          categoryBreakdown={report.categoryBreakdown}
          balanceTrend={report.balanceTrend}
          comparedWalletId={comparedWalletId}
          onCompareWallet={setComparedWalletId}
          currentWallets={report.currentWallets}
          datedWallets={report.datedWallets}
          asOf={report.values.asOf}
          balanceDate={balanceDate}
          trend={report.trend}
        />
      ) : (
        <>
          <div className="rounded-2xl bg-card p-5 shadow-card sm:p-6">
            {balanceDate}
          </div>
          <p role="alert" className="text-destructive text-sm">
            Choose a valid month and balance date.
          </p>
        </>
      )}
    </Page>
  );
}
