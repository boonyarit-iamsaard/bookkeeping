import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type {
  BalanceDateFieldProps,
  ReportMonthFieldProps,
} from "@/features/reports/components/report-pickers";
import type { FinancialReportProps } from "@/features/reports/components/report-sections";
import { reportMonthOf } from "@/features/reports/report-month";
import { useReportView } from "@/features/reports/report-reads";
import type { ReportSearch } from "@/features/reports/report-schema";
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

  const balanceDate = {
    today,
    value: report.values.asOf,
    invalid: report.invalidFields.has("asOf"),
    onChange: showBalanceDate,
  } satisfies BalanceDateFieldProps;

  const reportMonth = {
    thisMonth,
    value: report.values.month,
    invalid: report.invalidFields.has("month"),
    onChange: showMonth,
  } satisfies ReportMonthFieldProps;

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
          trend: report.trend,
        } satisfies Omit<FinancialReportProps, "balanceDate">)
      : undefined;

  return { state: report.state, sections, reportMonth, balanceDate };
}
