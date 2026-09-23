import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";

type MonthlyReport = components["schemas"]["MonthlyReport"];

const MONTH_ROWS = [
  { key: "income", label: "Income" },
  { key: "netExpenses", label: "Net expenses" },
  { key: "net", label: "Net" },
] as const;

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
          to="/dashboard"
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
        {MONTH_ROWS.map(({ key, label }) => (
          <div
            key={key}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 py-3",
              key === "net" && "font-semibold",
            )}
          >
            <dt>{label}</dt>
            <dd>
              <Money amount={report[key]} className="text-lg" />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
