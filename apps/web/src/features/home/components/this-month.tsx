import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { REPORT_FIGURE_LABELS } from "@/features/reports/report-labels";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";

type MonthlyReport = components["schemas"]["MonthlyReport"];

type Flow = "income" | "expense";

/** Each flow wears its chart token, so Home and Reports agree. */
const FLOW_HUE_CLASSES: Record<Flow, string> = {
  income: "[--hue:var(--chart-income)]",
  expense: "[--hue:var(--chart-expense)]",
};

interface FlowFigureProps {
  label: string;
  amount: MonthlyReport["income"];
  icon: LucideIcon;
  flow: Flow;
}

interface ThisMonthProps {
  report: Readonly<MonthlyReport>;
}

/** Income or Net expenses: its arrow tile in the chart color, then the figure. */
function FlowFigure({
  label,
  amount,
  icon: Icon,
  flow,
}: Readonly<FlowFigureProps>) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <dt className="flex items-center gap-2 text-muted-foreground text-sm">
        <span
          className={cn(
            "hue-tile flex size-7 shrink-0 items-center justify-center rounded-md",
            FLOW_HUE_CLASSES[flow],
          )}
        >
          <Icon aria-hidden="true" strokeWidth={2.25} className="size-4" />
        </span>
        {label}
      </dt>
      <dd className="wrap-break-word text-lg leading-tight">
        <Money amount={amount} />
      </dd>
    </div>
  );
}

/**
 * How the month is going, as the report counts it: money in and out side by
 * side, Net beneath. The whole card is the way into that month's report;
 * the link's name stays the heading.
 */
export function ThisMonth({ report }: Readonly<ThisMonthProps>) {
  return (
    <section
      aria-labelledby="this-month-heading"
      className="relative flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card transition-colors duration-150 has-[a:hover]:bg-[color-mix(in_oklch,var(--card),var(--accent)_70%)] motion-reduce:transition-none sm:p-6"
    >
      <h2 id="this-month-heading" className="font-bold text-lg tracking-tight">
        <Link
          to="/reports"
          search={{ month: report.month }}
          className="-my-2 flex min-h-11 items-center justify-between gap-2 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/45"
        >
          This month
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="size-5 text-muted-foreground"
          />
        </Link>
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
        <FlowFigure
          label={REPORT_FIGURE_LABELS.income}
          amount={report.income}
          icon={ArrowDownLeft}
          flow="income"
        />
        <FlowFigure
          label={REPORT_FIGURE_LABELS.netExpenses}
          amount={report.netExpenses}
          icon={ArrowUpRight}
          flow="expense"
        />
        <div className="col-span-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t pt-4">
          <dt className="font-semibold">{REPORT_FIGURE_LABELS.net}</dt>
          <dd className="text-xl">
            <Money amount={report.net} className="font-bold" />
          </dd>
        </div>
      </dl>
    </section>
  );
}
