import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import type { ReportFigure } from "@/features/reports/report-labels";
import { REPORT_FIGURE_LABELS } from "@/features/reports/report-labels";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";

type MonthlyReport = components["schemas"]["MonthlyReport"];

const MONTH_FIGURES = [
  "income",
  "netExpenses",
  "net",
] as const satisfies readonly ReportFigure[];

interface ThisMonthProps {
  report: Readonly<MonthlyReport>;
}

/**
 * How the month is going, as the report counts it. The whole block is the
 * way into that month's report; the link's name stays the heading.
 */
export function ThisMonth({ report }: Readonly<ThisMonthProps>) {
  return (
    <section
      aria-labelledby="this-month-heading"
      className="relative flex flex-col gap-1"
    >
      <h2 id="this-month-heading" className="pt-3 font-semibold text-lg">
        <Link
          to="/reports"
          search={{ month: report.month }}
          className="flex items-center justify-between gap-2 outline-none after:absolute after:inset-0 after:rounded-sm focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
        >
          This month
          <ChevronRight
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-5 text-muted-foreground"
          />
        </Link>
      </h2>
      <dl className="divide-y">
        {MONTH_FIGURES.map((key) => (
          <div
            key={key}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 py-3",
              key === "net" && "font-semibold",
            )}
          >
            <dt>{REPORT_FIGURE_LABELS[key]}</dt>
            <dd>
              <Money amount={report[key]} className="text-lg" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
