import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";
import type {
  CategoryBreakdown,
  CategoryLine,
  CategoryRow,
  CategorySegment,
} from "../category-breakdown";

interface SpendingByCategoryProps {
  breakdown: Readonly<CategoryBreakdown>;
  /** The chosen month, already formatted, such as "September 2026". */
  month: string;
}

/** A parent's fill: its hue, and the hatch that marks Uncategorized. */
function segmentClass(segment: Readonly<CategoryRow>): string {
  return cn("bg-(--hue)", segment.isUncategorized && "chart-hatch");
}

const LEGEND_LIST_CLASS = "flex flex-col divide-y divide-border/70";
const LEGEND_ROW_CLASS =
  "flex w-full items-center justify-between gap-3 py-3 text-left";

interface LegendRowProps {
  row: Readonly<CategoryRow>;
  /** The share stated beside the amount, when the row has one. */
  share?: ReactNode;
}

function lineName(line: Readonly<CategoryLine>, parentName: string): string {
  return line.kind === "direct" ? `Directly on ${parentName}` : line.name;
}

/**
 * One legend row: swatch, name, share and exact amount. A parent with
 * children is a disclosure that expands to the amount filed directly on it
 * and each child's, which add up to the parent.
 */
function LegendRow({ row, share }: Readonly<LegendRowProps>) {
  const [expanded, setExpanded] = useState(false);
  const linesId = useId();
  const expandable = row.lines.length > 0;
  const content = (
    <>
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span
          aria-hidden="true"
          data-hue={row.color}
          className={cn(
            "size-3 shrink-0 self-center rounded-sm",
            segmentClass(row),
          )}
        />
        <span className="wrap-break-word min-w-0">{row.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        {share}
        <Money amount={row.spending} />
        {expandable && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground",
              expanded && "rotate-180",
            )}
          />
        )}
      </span>
    </>
  );

  return (
    <li data-category-spending={row.name}>
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={linesId}
          onClick={() => setExpanded((open) => !open)}
          className={cn(
            LEGEND_ROW_CLASS,
            "min-h-11 cursor-pointer rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 sm:min-h-0",
          )}
        >
          {content}
        </button>
      ) : (
        <div className={LEGEND_ROW_CLASS}>{content}</div>
      )}
      {expandable && (
        <ul
          id={linesId}
          hidden={!expanded}
          aria-label={`${row.name} by category`}
          className="flex flex-col gap-2 pb-3 pl-5.5 text-sm"
        >
          {row.lines.map((line) => (
            <li
              key={line.kind === "direct" ? "direct" : line.id}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="wrap-break-word min-w-0 text-muted-foreground">
                {lineName(line, row.name)}
              </span>
              <Money amount={line.spending} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface ShareOfSpendingProps {
  segment: Readonly<CategorySegment>;
}

function ShareOfSpending({ segment }: Readonly<ShareOfSpendingProps>) {
  return (
    <span className="text-muted-foreground text-sm tabular-nums">
      {segment.shareLabel}
      <span className="sr-only"> of spending</span>
    </span>
  );
}

/**
 * The level 3 category breakdown bar: one bar split by each parent's share of
 * the month's positive spending, with a legend row per parent stating its
 * exact amount and share, so the bar itself is decorative. Parents with more
 * refunded than spent sit beneath it with their true minus, and no bar is
 * drawn when the month's Net expenses is zero or less.
 */
export function SpendingByCategory({
  breakdown,
  month,
}: Readonly<SpendingByCategoryProps>) {
  const refundedHeadingId = useId();
  if (breakdown.empty) {
    return (
      <p className="text-muted-foreground text-sm">No spending in {month}.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {breakdown.bar && (
        <div
          aria-hidden="true"
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-[4px]"
        >
          {breakdown.bar.map((segment) => (
            <div
              key={segment.id}
              data-hue={segment.color}
              className={cn("min-w-1", segmentClass(segment))}
              style={{ flex: `${segment.share} 1 0` }}
            />
          ))}
        </div>
      )}
      {breakdown.segments.length > 0 && (
        <ul className={cn(LEGEND_LIST_CLASS, "-my-3")}>
          {breakdown.segments.map((segment) => (
            <LegendRow
              key={segment.id}
              row={segment}
              share={<ShareOfSpending segment={segment} />}
            />
          ))}
        </ul>
      )}
      {breakdown.moreRefundedThanSpent.length > 0 && (
        <section
          aria-labelledby={refundedHeadingId}
          className="flex flex-col gap-1"
        >
          <h3 id={refundedHeadingId} className="font-semibold text-sm">
            More refunded than spent
          </h3>
          <ul className={cn(LEGEND_LIST_CLASS, "-mb-3")}>
            {breakdown.moreRefundedThanSpent.map((row) => (
              <LegendRow key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
