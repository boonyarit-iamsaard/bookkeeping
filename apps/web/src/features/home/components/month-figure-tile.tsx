import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Equal,
} from "lucide-react";
import { useId } from "react";
import type { components } from "@/core/api/openapi.gen";
import { FLOW_HUE_CLASSES } from "@/features/home/components/summary-card";
import type { FigureChange } from "@/features/home/figure-change";
import { figureChange } from "@/features/home/figure-change";
import { REPORT_FIGURE_LABELS } from "@/features/reports/report-labels";
import { formatReportMonthShort } from "@/features/reports/report-month";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";

type MonthlyReport = components["schemas"]["MonthlyReport"];

export type MonthFigure = "income" | "netExpenses" | "net";

interface MonthFigureTileProps {
  figure: MonthFigure;
  report: MonthlyReport;
  /** Last month's report; absent before the calendar's first month. */
  previous: MonthlyReport | undefined;
}

/** Income and Net expenses wear their flow's arrow tile, as on the phone's card. */
const FLOW_ICONS: Partial<
  Record<MonthFigure, { icon: LucideIcon; flow: "income" | "expense" }>
> = {
  income: { icon: ArrowDownLeft, flow: "income" },
  netExpenses: { icon: ArrowUpRight, flow: "expense" },
};

/** The sign carries the direction in text, so the arrow is never the only cue. */
export const CHANGE_MARKS: Record<
  FigureChange["direction"],
  { icon: LucideIcon; sign: string }
> = {
  up: { icon: ArrowUp, sign: "+" },
  down: { icon: ArrowDown, sign: "−" },
  same: { icon: Equal, sign: "" },
};

/**
 * One of this month's figures as a desktop tile, with how it moved from last
 * month beneath: in ink, never red or green, since a rise is good for Income
 * and bad for Net expenses.
 */
export function MonthFigureTile({
  figure,
  report,
  previous,
}: Readonly<MonthFigureTileProps>) {
  const headingId = useId();
  const flow = FLOW_ICONS[figure];
  const change = previous && figureChange(report[figure], previous[figure]);
  const mark = change && CHANGE_MARKS[change.direction];
  const lastMonth = previous && formatReportMonthShort(previous.month);
  return (
    <section
      aria-labelledby={headingId}
      className="bg-card shadow-card @container flex flex-col rounded-2xl p-6"
    >
      <h3
        id={headingId}
        className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
      >
        {flow && (
          <span
            className={cn(
              "hue-tile flex size-7 shrink-0 items-center justify-center rounded-md",
              FLOW_HUE_CLASSES[flow.flow],
            )}
          >
            <flow.icon
              aria-hidden="true"
              strokeWidth={2.25}
              className="size-4"
            />
          </span>
        )}
        {REPORT_FIGURE_LABELS[figure]}
      </h3>
      {/* A narrow tile steps the figure down rather than breaking it. */}
      <p className="mt-auto pt-4 text-lg leading-tight font-bold tracking-[-0.02em] wrap-break-word @[12rem]:text-2xl">
        <Money amount={report[figure]} className="font-bold" />
      </p>
      {change && mark && (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
          <mark.icon
            aria-hidden="true"
            strokeWidth={2.25}
            className="size-3.5 shrink-0"
          />
          {change.direction === "same" ? (
            <span>Same as {lastMonth}</span>
          ) : (
            <span>
              <Money amount={change.amount} sign={mark.sign} /> from {lastMonth}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
