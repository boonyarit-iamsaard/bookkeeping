import type { Bar } from "@/shared/helpers/bar-scale";
import { toPercent } from "@/shared/helpers/bar-scale";
import { cn } from "@/shared/helpers/cn";
import type { ChartSeries } from "./chart-series";
import { chartMarkClass } from "./chart-series";

interface BarTrackProps {
  bar: Bar;
  /** Where the zero line sits on the track, from the left. */
  zero: number;
  series: ChartSeries;
}

/**
 * One horizontal bar from the zero line. It is decorative: the row it sits in
 * states the figure as text.
 */
export function BarTrack({ bar, zero, series }: Readonly<BarTrackProps>) {
  return (
    <div
      aria-hidden="true"
      className="relative h-3 w-full rounded-sm bg-chart-grid/50"
    >
      {bar.length > 0 && (
        <div
          className={cn(
            "absolute inset-y-0 min-w-1 rounded-sm",
            chartMarkClass(series),
          )}
          style={{ left: toPercent(bar.start), width: toPercent(bar.length) }}
        />
      )}
      <div
        className="absolute -inset-y-1 w-px bg-chart-baseline"
        style={{ left: toPercent(zero) }}
      />
    </div>
  );
}
