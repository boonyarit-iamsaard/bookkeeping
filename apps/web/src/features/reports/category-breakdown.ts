import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { CategoryColor } from "@/features/categories/category-color";
import { parentCategoryColor } from "@/features/categories/category-color";

type CategorySpending = components["schemas"]["CategorySpending"];
type ParentCategorySpending = components["schemas"]["ParentCategorySpending"];

/** Shares are exact to a millionth before they become widths and words. */
const SHARE_SCALE = 1_000_000n;

export interface CategorySegment {
  id: string;
  name: string;
  isUncategorized: boolean;
  color: CategoryColor;
  /** The parent's Category spending, exactly as the server sent it. */
  spending: ApiMoney;
  /** Its fraction of the month's spending, from 0 to 1. */
  share: number;
  /** The share as a whole percent; never "0%" for a parent with spending. */
  shareLabel: string;
}

export interface CategoryBreakdown {
  /** The bar's segments and legend rows, in category order, Uncategorized last. */
  segments: CategorySegment[];
  /** No expense or refund was dated in the month. */
  empty: boolean;
}

function inCategoryOrder(
  first: Readonly<ParentCategorySpending>,
  second: Readonly<ParentCategorySpending>,
): number {
  return (
    Number(first.isUncategorized) - Number(second.isUncategorized) ||
    first.sortOrder - second.sortOrder
  );
}

function shareLabelOf(share: number): string {
  const percent = Math.round(share * 100);
  return percent === 0 && share > 0 ? "<1%" : `${percent}%`;
}

/** The category breakdown bar and its legend, derived from one month's read. */
export function createCategoryBreakdown(
  spending: Readonly<CategorySpending>,
): CategoryBreakdown {
  // The server's Net expenses is the whole the parents add up to.
  const total = parseApiMoney(spending.netExpenses);
  const parents = spending.parents.toSorted(inCategoryOrder);

  const segments = parents.map((parent) => {
    const amount = parseApiMoney(parent.spending);
    const share =
      total > 0n
        ? Number((amount * SHARE_SCALE) / total) / Number(SHARE_SCALE)
        : 0;
    return {
      id: parent.id,
      name: parent.name,
      isUncategorized: parent.isUncategorized,
      color: parentCategoryColor({
        id: parent.id,
        isProtected: parent.isUncategorized,
      }),
      spending: parent.spending,
      share,
      shareLabel: shareLabelOf(share),
    };
  });
  return { segments, empty: parents.length === 0 };
}
