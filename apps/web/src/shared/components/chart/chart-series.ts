import { cn } from "@/shared/helpers/cn";

/**
 * What a mark stands for. Position and the label always say it too: the
 * expense and negative marks are also hatched, so color is never the only
 * signal.
 */
export type ChartSeries = "income" | "expense" | "balance" | "negative";

const SERIES_CLASSES = {
  income: "[--hue:var(--chart-income)]",
  expense: "[--hue:var(--chart-expense)] chart-hatch",
  balance: "[--hue:var(--chart-1)]",
  negative: "[--hue:var(--chart-1)] chart-hatch",
} as const satisfies Record<ChartSeries, string>;

/** A mark's fill: its hue, plus the hatch for the series that carry one. */
export function chartMarkClass(series: ChartSeries): string {
  return cn("bg-(--hue)", SERIES_CLASSES[series]);
}
