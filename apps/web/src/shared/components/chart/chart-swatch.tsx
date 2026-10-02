import { cn } from "@/shared/helpers/cn";
import type { ChartSeries } from "./chart-series";
import { chartMarkClass } from "./chart-series";

interface ChartSwatchProps {
  series: ChartSeries;
}

/** The key beside a series' label: the mark's own fill, hatch included. */
export function ChartSwatch({ series }: Readonly<ChartSwatchProps>) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-3 shrink-0 rounded-sm", chartMarkClass(series))}
    />
  );
}
