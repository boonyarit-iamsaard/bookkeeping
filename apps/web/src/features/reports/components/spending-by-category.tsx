import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Money } from "@/shared/components/money";
import { cn } from "@/shared/helpers/cn";
import type {
  CategoryBreakdown,
  CategoryLine,
  CategoryRow,
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

/**
 * The legend is one grid of name, share, amount and disclosure columns, and
 * every row and expanded line takes it up as a subgrid, so shares and amounts
 * stack in columns whether or not a row has a chevron.
 */
const LEGEND_LIST_CLASS =
  "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] divide-y divide-border/70";
const LEGEND_SUBGRID_CLASS = "col-span-full grid grid-cols-subgrid";
const LEGEND_ROW_CLASS = cn(
  LEGEND_SUBGRID_CLASS,
  "items-center gap-x-2 py-3 text-left",
);

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
        <span className="min-w-0 wrap-break-word">{row.name}</span>
      </span>
      <span className="justify-self-end">{share}</span>
      <Money amount={row.spending} className="justify-self-end" />
      <span aria-hidden="true" className="size-4">
        {expandable && (
          <ChevronDown
            className={cn(
              "text-muted-foreground size-4",
              expanded && "rotate-180",
            )}
          />
        )}
      </span>
    </>
  );

  return (
    <li data-category-spending={row.name} className={LEGEND_SUBGRID_CLASS}>
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={linesId}
          onClick={() => setExpanded((open) => !open)}
          className={cn(
            LEGEND_ROW_CLASS,
            "focus-visible:ring-ring/45 min-h-11 cursor-pointer rounded-sm outline-none focus-visible:ring-[3px] sm:min-h-0",
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
          className={cn(LEGEND_SUBGRID_CLASS, "gap-y-2 pb-3 text-sm")}
        >
          {row.lines.map((line) => (
            <li
              key={line.kind === "direct" ? "direct" : line.id}
              className={cn(LEGEND_SUBGRID_CLASS, "items-baseline gap-x-2")}
            >
              <span className="text-muted-foreground col-span-2 min-w-0 pl-5.5 wrap-break-word">
                {lineName(line, row.name)}
              </span>
              <Money amount={line.spending} className="justify-self-end" />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface ShareOfSpendingProps {
  shareLabel: string;
}

function ShareOfSpending({ shareLabel }: Readonly<ShareOfSpendingProps>) {
  return (
    <span className="text-muted-foreground text-sm tabular-nums">
      {shareLabel}
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
              className={cn(
                "ease-out-expo min-w-1 transition-[flex-grow] duration-300 motion-reduce:transition-none",
                segmentClass(segment),
              )}
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
              share={
                segment.shareLabel && (
                  <ShareOfSpending shareLabel={segment.shareLabel} />
                )
              }
            />
          ))}
        </ul>
      )}
      {breakdown.moreRefundedThanSpent.length > 0 && (
        <section
          aria-labelledby={refundedHeadingId}
          className="flex flex-col gap-1"
        >
          <h3 id={refundedHeadingId} className="text-sm font-semibold">
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
