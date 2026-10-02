import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import { DatePicker } from "@/shared/components/date-picker";
import { MonthPicker } from "@/shared/components/month-picker";
import { reportMonthOf } from "../report-month";
import { createReportQueryPlan } from "../report-queries";
import type { ReportSearch } from "../report-schema";
import { createTrendSeries } from "../trend-series";
import { FinancialReport } from "./financial-report";

interface ReportsProps {
  search: Readonly<ReportSearch>;
  initialToday: CalendarDate;
}

export function Reports({ search, initialToday }: Readonly<ReportsProps>) {
  const today = useBangkokToday(initialToday);
  const thisMonth = reportMonthOf(today);
  const plan = createReportQueryPlan(search, today);
  const report = useQuery({
    ...plan.monthly,
    enabled: plan.valid,
    throwOnError: true,
  });
  const currentWallets = useQuery({
    ...plan.currentWallets,
    enabled: plan.valid,
    throwOnError: true,
  });
  const datedWallets = useQuery({
    ...plan.datedWallets,
    enabled: plan.valid,
    throwOnError: true,
  });
  const trendQueries = useQueries({
    queries: plan.trend.map((query) => ({
      ...query,
      throwOnError: true,
    })),
  });
  const trendReports = trendQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  const navigate = useNavigate({ from: "/reports" });

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
        key={plan.values.asOf}
        id="balance-date"
        today={today}
        max={today}
        defaultValue={plan.values.asOf}
        invalid={plan.invalidFields.has("asOf")}
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
              key={plan.values.month}
              id="report-month"
              thisMonth={thisMonth}
              max={thisMonth}
              defaultValue={plan.values.month}
              invalid={plan.invalidFields.has("month")}
              onChange={showMonth}
              className="w-auto"
            />
          </>
        }
      />
      {plan.valid &&
      report.data !== undefined &&
      currentWallets.data !== undefined &&
      datedWallets.data !== undefined &&
      trendReports.length === plan.trend.length ? (
        <FinancialReport
          summary={report.data}
          currentWallets={currentWallets.data.items}
          datedWallets={datedWallets.data.items}
          asOf={plan.values.asOf}
          balanceDate={balanceDate}
          trend={createTrendSeries(trendReports)}
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
