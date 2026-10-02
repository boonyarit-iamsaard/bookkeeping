import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { useState } from "react";
import { parseApiMoney } from "@/core/api/money";
import { ChartSwatch } from "@/shared/components/chart/chart-swatch";
import { Money } from "@/shared/components/money";
import { toPercent } from "@/shared/helpers/bar-scale";
import type { BalanceDay, BalancePoint, BalanceTrend } from "../balance-trend";

interface BalanceOverTimeProps {
  trend: Readonly<BalanceTrend>;
  /** The chosen month, already formatted, such as "September 2026". */
  month: string;
}

const NO_WALLETS_OPEN = "No wallets open";

/** Plot coordinates: x across 0–100, y down from the top. */
function plotPoint(point: Readonly<BalancePoint>): string {
  return `${point.x * 100},${(1 - point.y) * 100}`;
}

/** The wash beneath a run: down to the plot's floor at both ends. */
function washPoints(run: readonly BalancePoint[]): string {
  const first = run[0];
  const last = run.at(-1);
  if (!first || !last) {
    return "";
  }
  return [
    `${first.x * 100},100`,
    ...run.map(plotPoint),
    `${last.x * 100},100`,
  ].join(" ");
}

function totalText(day: Readonly<BalanceDay>): string {
  return day.total === null
    ? NO_WALLETS_OPEN
    : formatMoney({
        amountInMinorUnits: parseApiMoney(day.total),
        currency: day.total.currency,
      });
}

const PAGE_DAYS = 7;

/**
 * The level 3 balance trend: the total Closing balance across the month as
 * one line, from the earliest opening date to the last day read. The plot is
 * a slider over the days with a balance, so the selected day can be moved by
 * pointer or keys, and its exact figure is read out beneath; a table carries
 * every day for assistive technology.
 */
export function BalanceOverTime({
  trend,
  month,
}: Readonly<BalanceOverTimeProps>) {
  if (trend.kind === "future") {
    return (
      <p className="text-muted-foreground text-sm">Nothing yet in {month}.</p>
    );
  }
  if (trend.kind === "untracked") {
    return (
      <p className="text-muted-foreground text-sm">
        No wallets were open in {month}.
      </p>
    );
  }
  return <BalanceLine trend={trend} month={month} />;
}

interface BalanceLineProps {
  trend: Readonly<Extract<BalanceTrend, { kind: "line" }>>;
  month: string;
}

function BalanceLine({ trend, month }: Readonly<BalanceLineProps>) {
  const [selectedDate, setSelectedDate] = useState(trend.selected);
  const points = trend.runs.flat();
  const selectedIndex = Math.max(
    points.findIndex((point) => point.date === selectedDate),
    0,
  );
  const selectedPoint = points[selectedIndex];
  const selectedDay = trend.days.find((day) => day.date === selectedDate);

  function select(index: number) {
    const point = points[Math.min(Math.max(index, 0), points.length - 1)];
    if (point) {
      setSelectedDate(point.date);
    }
  }

  /** The day nearest the pointer, among the days with a balance. */
  function selectAt(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    let nearest = 0;
    for (const [index, point] of points.entries()) {
      if (Math.abs(point.x - x) < Math.abs(points[nearest].x - x)) {
        nearest = index;
      }
    }
    select(nearest);
  }

  // How far each slider key moves the selected day; Home and End overshoot to the ends.
  const keySteps = new Map([
    ["ArrowLeft", -1],
    ["ArrowDown", -1],
    ["ArrowRight", 1],
    ["ArrowUp", 1],
    ["PageDown", -PAGE_DAYS],
    ["PageUp", PAGE_DAYS],
    ["Home", -points.length],
    ["End", points.length],
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* A table ignores the clip of its own sr-only, so a wrapper holds it. */}
      <div className="sr-only">
        <table>
          <caption>Total closing balance for each day of {month}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Total balance</th>
            </tr>
          </thead>
          <tbody>
            {trend.days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatCalendarDate(day.date)}</th>
                <td>
                  {day.total === null ? (
                    NO_WALLETS_OPEN
                  ) : (
                    <Money amount={day.total} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Selected day"
        aria-valuemin={1}
        aria-valuemax={points.length}
        aria-valuenow={selectedIndex + 1}
        aria-valuetext={
          selectedDay
            ? `${formatCalendarDate(selectedDay.date)}, ${totalText(selectedDay)}`
            : undefined
        }
        onKeyDown={(event) => {
          const step = keySteps.get(event.key);
          if (step !== undefined) {
            event.preventDefault();
            select(selectedIndex + step);
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          selectAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            selectAt(event);
          }
        }}
        className="relative h-44 cursor-pointer touch-pan-y rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {trend.runs.map((run) => (
            <g key={run[0]?.date}>
              <polygon points={washPoints(run)} className="fill-border" />
              <polyline
                points={run.map(plotPoint).join(" ")}
                vectorEffect="non-scaling-stroke"
                className="fill-none stroke-2 stroke-chart-1 [stroke-linecap:round] [stroke-linejoin:round]"
              />
            </g>
          ))}
        </svg>
        {trend.zero !== null && (
          <div
            data-zero-line
            className="pointer-events-none absolute inset-x-0 h-px bg-chart-baseline"
            style={{ bottom: toPercent(trend.zero) }}
          />
        )}
        {selectedPoint && (
          <div
            aria-hidden="true"
            data-selected-day={selectedPoint.date}
            className="pointer-events-none absolute size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-1"
            style={{
              left: toPercent(selectedPoint.x),
              bottom: toPercent(selectedPoint.y),
            }}
          />
        )}
      </div>
      <div
        aria-live="polite"
        className="flex flex-col gap-2.5 border-t pt-4"
        data-balance-readout
      >
        <p className="font-semibold text-sm">
          {selectedDay ? formatCalendarDate(selectedDay.date) : null}
        </p>
        <dl className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-sm">
            <ChartSwatch series="balance" />
            Total balance
          </dt>
          <dd>
            {selectedDay?.total ? (
              <Money amount={selectedDay.total} />
            ) : (
              NO_WALLETS_OPEN
            )}
          </dd>
        </dl>
      </div>
    </div>
  );
}
