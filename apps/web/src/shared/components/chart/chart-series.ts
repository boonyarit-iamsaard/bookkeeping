import { cn } from "@/shared/helpers/cn";

/**
 * What a mark stands for. Position and the label always say it too: the
 * negative mark is also hatched; the expense mark is solid amber and leans on
 * its label and position.
 */
export type ChartSeries = "income" | "expense" | "balance" | "negative";

const SERIES_CLASSES = {
  income: "[--hue:var(--chart-income)]",
  expense: "[--hue:var(--chart-expense)]",
  balance: "[--hue:var(--chart-1)]",
  negative: "[--hue:var(--chart-1)] chart-hatch",
} as const satisfies Record<ChartSeries, string>;

/** A mark's fill: its hue, plus the hatch for the series that carry one. */
export function chartMarkClass(series: ChartSeries): string {
  return cn("bg-(--hue)", SERIES_CLASSES[series]);
}
