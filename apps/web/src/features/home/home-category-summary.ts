import type { CategoryBreakdown } from "@/features/reports/category-breakdown";

/** Home's card fits this many parents; Reports holds the rest. */
const HOME_CATEGORY_LIMIT = 6;

interface HomeCategorySummary {
  /** The month's breakdown cut to the largest parents; the bar still spans the month. */
  breakdown: CategoryBreakdown;
  /** Parents left for Reports, those refunded past their spending included. */
  hiddenCount: number;
}

/** The category breakdown as Home shows it: top six, then a count of the rest. */
export function createHomeCategorySummary(
  breakdown: Readonly<CategoryBreakdown>,
): HomeCategorySummary {
  return {
    breakdown: {
      ...breakdown,
      segments: breakdown.segments.slice(0, HOME_CATEGORY_LIMIT),
      moreRefundedThanSpent: [],
    },
    hiddenCount:
      Math.max(breakdown.segments.length - HOME_CATEGORY_LIMIT, 0) +
      breakdown.moreRefundedThanSpent.length,
  };
}
