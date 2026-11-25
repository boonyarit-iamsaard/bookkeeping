import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useQueries, useSuspenseQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { TrendChart } from "@/features/reports/components/trend-chart";
import { reportMonthOf } from "@/features/reports/report-month";
import { createTrendSeries } from "@/features/reports/trend-series";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { sectionLinkClass } from "@/shared/components/list-section";
import { SegmentedControl } from "@/shared/components/ui/segmented-control";
import { cn } from "@/shared/helpers/cn";

type Span = "6" | "12";

const SPAN_OPTIONS = [
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
] as const;

interface CashFlowCardProps {
  today: CalendarDate;
}

/**
 * Income against Net expenses per report month, six or twelve of them. The six
 * load with Home; while the twelve load, or if they fail, the six stay in
 * place, so the longer trend never takes Home down with it.
 */
export function CashFlowCard({ today }: Readonly<CashFlowCardProps>) {
  const [span, setSpan] = useState<Span>("6");
  const plan = createHomeQueryPlan(today);
  const six = useSuspenseQueries({ queries: plan.trend() });
  const twelve = useQueries({ queries: span === "12" ? plan.trend(12) : [] });
  const twelveShown =
    twelve.length > 0 && twelve.every((query) => query.isSuccess);
  const twelveFailed = twelve.some((query) => query.isError);
  const loading = span === "12" && !twelveShown && !twelveFailed;
  const reports = twelveShown
    ? twelve.map((query) => query.data)
    : six.map((query) => query.data);
  return (
    <DashboardCard
      headingId="cash-flow-heading"
      heading="Cash flow"
      action={
        <div className="flex items-center gap-6">
          <Link
            to="/reports"
            search={{ month: reportMonthOf(today) }}
            className={sectionLinkClass}
          >
            Reports
            <ArrowRight
              aria-hidden="true"
              strokeWidth={2}
              className="size-3.5"
            />
          </Link>
          <span id="cash-flow-span" className="sr-only">
            Months shown
          </span>
          <SegmentedControl
            options={SPAN_OPTIONS}
            value={span}
            onValueChange={setSpan}
            aria-labelledby="cash-flow-span"
            className="w-56"
          />
        </div>
      }
    >
      {twelveFailed && (
        <p role="alert" className="text-muted-foreground text-sm">
          Twelve months could not load, so six are shown.{" "}
          <button
            type="button"
            onClick={() => {
              for (const query of twelve) {
                if (query.isError) {
                  void query.refetch();
                }
              }
            }}
            className={sectionLinkClass}
          >
            Try again
          </button>
        </p>
      )}
      <div aria-busy={loading} className={cn(loading && "opacity-60")}>
        <TrendChart
          key={reports.length}
          points={createTrendSeries(
            reports.filter((report) => report !== undefined),
          )}
        />
      </div>
    </DashboardCard>
  );
}
