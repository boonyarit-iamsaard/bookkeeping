import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";
import type { CategoryBreakdown, CategorySegment } from "../category-breakdown";

interface SpendingByCategoryProps {
  breakdown: Readonly<CategoryBreakdown>;
  /** The chosen month, already formatted, such as "September 2026". */
  month: string;
}

/** A parent's fill: its hue, and the hatch that marks Uncategorized. */
function segmentClass(segment: Readonly<CategorySegment>): string {
  return cn("bg-(--hue)", segment.isUncategorized && "chart-hatch");
}

/**
 * The level 3 category breakdown bar: one bar split by each parent's share of
 * the month's spending, with a legend row per parent stating its exact amount
 * and share, so the bar itself is decorative.
 */
export function SpendingByCategory({
  breakdown,
  month,
}: Readonly<SpendingByCategoryProps>) {
  if (breakdown.empty) {
    return (
      <p className="text-muted-foreground text-sm">No spending in {month}.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        aria-hidden="true"
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px]"
      >
        {breakdown.segments.map((segment) => (
          <div
            key={segment.id}
            data-hue={segment.color}
            className={cn("min-w-1", segmentClass(segment))}
            style={{ flex: `${segment.share} 1 0` }}
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-border/70">
        {breakdown.segments.map((segment) => (
          <li
            key={segment.id}
            data-category-spending={segment.name}
            className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <span className="flex min-w-0 items-baseline gap-2.5">
              <span
                aria-hidden="true"
                data-hue={segment.color}
                className={cn(
                  "size-3 shrink-0 self-center rounded-sm",
                  segmentClass(segment),
                )}
              />
              <span className="wrap-break-word min-w-0">{segment.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2.5">
              <span className="text-muted-foreground text-sm tabular-nums">
                {segment.shareLabel}
                <span className="sr-only"> of spending</span>
              </span>
              <Money amount={segment.spending} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
