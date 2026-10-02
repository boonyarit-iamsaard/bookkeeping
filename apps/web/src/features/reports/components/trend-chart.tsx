import { formatMoneyInput } from "@bookkeeping/domain/money";
import { useState } from "react";
import type { ApiMoney } from "@/core/api/money";
import { chartMarkClass } from "@/shared/components/chart/chart-series";
import { ChartSwatch } from "@/shared/components/chart/chart-swatch";
import { Money } from "@/shared/components/money";
import { scaleBars, toPercent } from "@/shared/helpers/bar-scale";
import { cn } from "@/shared/helpers/cn";
import { formatReportMonth, formatReportMonthShort } from "../report-month";
import type { TrendPoint } from "../trend-series";

interface TrendChartProps {
  points: readonly TrendPoint[];
}

const SERIES = [
  { key: "income", label: "Income", series: "income" },
  { key: "netExpenses", label: "Net expenses", series: "expense" },
] as const;

function toApiMoney(amountInMinorUnits: bigint): ApiMoney {
  return {
    value: formatMoneyInput({ amountInMinorUnits, currency: "THB" }),
    currency: "THB",
  };
}

/**
 * The level 2 chart: Income and Net expenses for the six months ending at the
 * chosen one, as paired columns from one zero line. A month's exact figures
 * are the readout beneath it, and a table for assistive technology.
 */
export function TrendChart({ points }: Readonly<TrendChartProps>) {
  const [chosen, setChosen] = useState(points.length - 1);
  const everyMonthEmpty = points.every((point) => point.empty);
  const selected = points[chosen] ?? points.at(-1);
  const { zero, bars } = scaleBars(
    points.flatMap((point) => [point.income, point.netExpenses]),
  );

  if (everyMonthEmpty || !selected) {
    return (
      <p className="text-muted-foreground text-sm">
        Nothing recorded in these six months.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* A table ignores the clip of its own sr-only, so a wrapper holds it. */}
      <div className="sr-only">
        <table>
          <caption>
            Income and net expenses for each of the last six months
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Net expenses</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{formatReportMonth(point.month)}</th>
                <td>
                  <Money amount={toApiMoney(point.income)} />
                </td>
                <td>
                  <Money amount={toApiMoney(point.netExpenses)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden="true" className="relative flex gap-1">
        {points.map((point, index) => (
          <div
            key={point.month}
            className={cn(
              "relative h-44 flex-1 rounded-lg transition-colors duration-150 motion-reduce:transition-none",
              index === chosen && "bg-accent",
            )}
          >
            {SERIES.map((series, seriesIndex) => {
              const bar = bars[index * SERIES.length + seriesIndex];
              return (
                bar.length > 0 && (
                  <div
                    key={series.key}
                    className={cn(
                      "absolute min-h-1 w-[30%] rounded-sm",
                      seriesIndex === 0 ? "left-[17%]" : "right-[17%]",
                      chartMarkClass(series.series),
                    )}
                    style={{
                      bottom: toPercent(bar.start),
                      height: toPercent(bar.length),
                    }}
                  />
                )
              );
            })}
          </div>
        ))}
        <div
          className="pointer-events-none absolute inset-x-0 h-px bg-chart-baseline"
          style={{ bottom: toPercent(zero) }}
        />
      </div>
      <fieldset className="m-0 flex min-w-0 gap-1 border-0 p-0">
        <legend className="sr-only">Choose a month to read</legend>
        {points.map((point, index) => (
          <button
            key={point.month}
            type="button"
            aria-pressed={index === chosen}
            aria-label={`Show ${formatReportMonth(point.month)}`}
            onClick={() => setChosen(index)}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center rounded-lg text-muted-foreground text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/45",
              index === chosen && "font-bold text-foreground",
            )}
          >
            {formatReportMonthShort(point.month)}
            {(index === 0 || point.month.endsWith("-01")) && (
              <span className="font-normal">{point.month.slice(0, 4)}</span>
            )}
          </button>
        ))}
      </fieldset>
      <div aria-live="polite" className="flex flex-col gap-2.5 border-t pt-4">
        <p className="font-semibold text-sm">
          {formatReportMonth(selected.month)}
        </p>
        {selected.empty ? (
          <p className="text-muted-foreground text-sm">
            Nothing recorded in this month.
          </p>
        ) : (
          <dl className="flex flex-col gap-2">
            {SERIES.map((series) => (
              <div
                key={series.key}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ChartSwatch series={series.series} />
                  {series.label}
                </dt>
                <dd>
                  <Money amount={toApiMoney(selected[series.key])} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
