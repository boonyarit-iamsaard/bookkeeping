import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { SummaryCard } from "@/features/home/components/summary-card";

type DailyReport = components["schemas"]["DailyReport"];
type MonthlyReport = components["schemas"]["MonthlyReport"];

interface TodayCardProps {
  report: DailyReport;
}

interface MonthCardProps {
  report: MonthlyReport;
}

/** Today's figures, linking to the day's records. */
export function TodayCard({ report }: Readonly<TodayCardProps>) {
  return (
    <SummaryCard
      heading="Today"
      report={report}
      renderLink={({ className, children }) => (
        <Link
          to="/transactions"
          search={{ from: report.date, to: report.date }}
          className={className}
        >
          {children}
        </Link>
      )}
    />
  );
}

/** The month's figures, linking to its report. */
export function MonthCard({ report }: Readonly<MonthCardProps>) {
  return (
    <SummaryCard
      heading="This month"
      report={report}
      renderLink={({ className, children }) => (
        <Link
          to="/reports"
          search={{ month: report.month }}
          className={className}
        >
          {children}
        </Link>
      )}
    />
  );
}
