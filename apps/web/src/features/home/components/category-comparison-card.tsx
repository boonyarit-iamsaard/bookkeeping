import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CHANGE_MARKS } from "@/features/home/components/month-figure-tile";
import { figureChange } from "@/features/home/figure-change";
import type { CategoryComparisonRow } from "@/features/home/home-category-comparison";
import { compareCategorySpending } from "@/features/home/home-category-comparison";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import {
  formatReportMonth,
  formatReportMonthShort,
} from "@/features/reports/report-month";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { sectionLinkClass } from "@/shared/components/list-section";
import { Money } from "@/shared/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";
import { pluralize } from "@/shared/helpers/pluralize";

interface CategoryComparisonCardProps {
  today: CalendarDate;
}

// This month's mark is the parent's hue; last month's is the same hue faded, told apart by position and the key.
const MONTH_MARKS = {
  current: "bg-(--hue)",
  previous: "bg-(--hue) opacity-40",
} as const;

function hueClass(
  row: Readonly<Pick<CategoryComparisonRow, "isUncategorized">>,
) {
  return cn(row.isUncategorized && "chart-hatch");
}

/** The key is the bar itself in the neutral hue: hue names categories, not months. */
interface MonthKeyProps {
  label: string;
  mark: string;
}

function MonthKey({ label, mark }: Readonly<MonthKeyProps>) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        data-hue="neutral"
        className={cn("h-3 w-4 rounded-[4px]", mark)}
      />
      {label}
    </span>
  );
}

interface ComparisonBarsProps {
  row: CategoryComparisonRow;
  /** False in the calendar's first month, which has no month before it. */
  hasPrevious: boolean;
}

function ComparisonBars({ row, hasPrevious }: Readonly<ComparisonBarsProps>) {
  return (
    <span aria-hidden="true" className="mt-2 flex flex-col gap-1">
      {(hasPrevious
        ? (["current", "previous"] as const)
        : (["current"] as const)
      ).map((month) => {
        const share =
          month === "current" ? row.currentShare : row.previousShare;
        return (
          <span key={month} className="bg-border/50 block h-3 rounded-[4px]">
            {share > 0 && (
              <span
                className={cn(
                  "block h-full min-w-1 rounded-[4px]",
                  MONTH_MARKS[month],
                  hueClass(row),
                )}
                style={{ width: `${share * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

interface ChangeCellProps {
  row: CategoryComparisonRow;
}

function ChangeCell({ row }: Readonly<ChangeCellProps>) {
  const change = figureChange(row.current, row.previous);
  const mark = CHANGE_MARKS[change.direction];
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      <mark.icon aria-hidden="true" strokeWidth={2.25} className="size-3.5" />
      {change.direction === "same" ? (
        "Same"
      ) : (
        <Money amount={change.amount} sign={mark.sign} />
      )}
    </span>
  );
}

/**
 * This month's Category spending beside last month's, a row per parent with
 * both months' bars on one scale and the exact figures and change beside
 * them, so the marks themselves are decorative.
 */
export function CategoryComparisonCard({
  today,
}: Readonly<CategoryComparisonCardProps>) {
  const plan = createHomeQueryPlan(today);
  const { data: current } = useSuspenseQuery(plan.categorySpending);
  const previous = useSuspenseQueries({
    queries: plan.lastMonthCategorySpending,
  }).at(0)?.data;
  const month = current.month;
  const previousMonth = previous?.month;
  const { rows, hiddenCount } = compareCategorySpending(
    current,
    previous ?? { ...current, parents: [] },
  );
  const thisMonth = formatReportMonthShort(month);
  const lastMonth = previousMonth && formatReportMonthShort(previousMonth);
  return (
    <DashboardCard
      headingId="home-categories-heading"
      heading="Spending by category"
      action={
        rows.length > 0 && (
          <span className="flex items-center gap-4">
            <MonthKey label={thisMonth} mark={MONTH_MARKS.current} />
            {lastMonth && (
              <MonthKey label={lastMonth} mark={MONTH_MARKS.previous} />
            )}
          </span>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No spending in {formatReportMonth(month)}
          {previousMonth && ` or ${formatReportMonth(previousMonth)}`}.
        </p>
      ) : (
        <Table aria-label="Spending by category, this month beside last month">
          <TableHeader>
            <TableRow>
              <TableHead className="w-full">Category</TableHead>
              <TableHead className="text-right">{thisMonth}</TableHead>
              {lastMonth && (
                <TableHead className="text-right">{lastMonth}</TableHead>
              )}
              {lastMonth && (
                <TableHead className="text-right">
                  Change from {lastMonth}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                data-category-spending={row.name}
                data-hue={row.color}
              >
                <TableCell className="max-w-0 align-top">
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-3 shrink-0 rounded-sm",
                        MONTH_MARKS.current,
                        hueClass(row),
                      )}
                    />
                    <span className="truncate">{row.name}</span>
                  </span>
                  <ComparisonBars row={row} hasPrevious={Boolean(lastMonth)} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <Money amount={row.current} />
                </TableCell>
                {lastMonth && (
                  <TableCell className="text-right align-top">
                    <Money amount={row.previous} />
                  </TableCell>
                )}
                {lastMonth && (
                  <TableCell className="text-right align-top">
                    <ChangeCell row={row} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {hiddenCount > 0 && (
        <Link
          to="/reports"
          search={{ month }}
          className={`${sectionLinkClass} mt-auto self-start`}
        >
          {pluralize(hiddenCount, ["more category", "more categories"])} in{" "}
          {formatReportMonth(month)}
          <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </Link>
      )}
    </DashboardCard>
  );
}
