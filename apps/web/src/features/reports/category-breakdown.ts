import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { CategoryColor } from "@/features/categories/category-color";
import { parentCategoryColor } from "@/features/categories/category-color";

type CategorySpending = components["schemas"]["CategorySpending"];
type ParentCategorySpending = components["schemas"]["ParentCategorySpending"];
type ChildCategorySpending = components["schemas"]["ChildCategorySpending"];

/** Shares are exact to a millionth before they become widths and words. */
const SHARE_SCALE = 1_000_000n;

/** One line of an expanded parent; together they add up to the parent. */
export type CategoryLine =
  | {
      kind: "direct";
      /** The amount filed directly on the parent rather than a child. */
      spending: ApiMoney;
    }
  | { kind: "child"; id: string; name: string; spending: ApiMoney };

export interface CategoryRow {
  id: string;
  name: string;
  isUncategorized: boolean;
  color: CategoryColor;
  /** The parent's Category spending, exactly as the server sent it. */
  spending: ApiMoney;
  /** What the row expands to; empty when the parent has no children. */
  lines: CategoryLine[];
}

export interface CategorySegment extends CategoryRow {
  /** Its fraction of the month's positive spending, from 0 to 1. */
  share: number;
  /**
   * The share as a whole percent, never "0%" for a parent with spending, or
   * null when no bar is drawn and a proportion would mean nothing.
   */
  shareLabel: string | null;
}

export interface CategoryBreakdown {
  /** Legend rows for parents not below zero, in category order, Uncategorized last. */
  segments: CategorySegment[];
  /** The segments the bar draws, or null when Net expenses is zero or less. */
  bar: CategorySegment[] | null;
  /** Parents whose refunds outran their spending, listed beneath the bar. */
  moreRefundedThanSpent: CategoryRow[];
  /** No expense or refund was dated in the month. */
  empty: boolean;
}

function inCategoryOrder(
  first: Readonly<
    Pick<ParentCategorySpending, "isUncategorized" | "sortOrder">
  >,
  second: Readonly<
    Pick<ParentCategorySpending, "isUncategorized" | "sortOrder">
  >,
): number {
  return (
    Number(first.isUncategorized) - Number(second.isUncategorized) ||
    first.sortOrder - second.sortOrder
  );
}

function childInCategoryOrder(
  first: Readonly<ChildCategorySpending>,
  second: Readonly<ChildCategorySpending>,
): number {
  return first.sortOrder - second.sortOrder;
}

function shareLabelOf(share: number): string {
  const percent = Math.round(share * 100);
  return percent === 0 && share > 0 ? "<1%" : `${percent}%`;
}

function linesOf(parent: Readonly<ParentCategorySpending>): CategoryLine[] {
  if (parent.children.length === 0) {
    return [];
  }
  const children = parent.children.toSorted(childInCategoryOrder).map(
    (child): CategoryLine => ({
      kind: "child",
      id: child.id,
      name: child.name,
      spending: child.spending,
    }),
  );
  return parseApiMoney(parent.directSpending) === 0n
    ? children
    : [{ kind: "direct", spending: parent.directSpending }, ...children];
}

function rowOf(parent: Readonly<ParentCategorySpending>): CategoryRow {
  return {
    id: parent.id,
    name: parent.name,
    isUncategorized: parent.isUncategorized,
    color: parentCategoryColor({
      id: parent.id,
      isProtected: parent.isUncategorized,
    }),
    spending: parent.spending,
    lines: linesOf(parent),
  };
}

/** The category breakdown bar and its legend, derived from one month's read. */
export function createCategoryBreakdown(
  spending: Readonly<CategorySpending>,
): CategoryBreakdown {
  const parents = spending.parents
    .toSorted(inCategoryOrder)
    .map((parent) => ({ parent, amount: parseApiMoney(parent.spending) }));
  const hasBar = parseApiMoney(spending.netExpenses) > 0n;
  const positiveSpending = parents.reduce(
    (total, { amount }) => (amount > 0n ? total + amount : total),
    0n,
  );

  const segments = parents
    .filter(({ amount }) => amount >= 0n)
    .map(({ parent, amount }) => {
      const share =
        positiveSpending > 0n
          ? Number((amount * SHARE_SCALE) / positiveSpending) /
            Number(SHARE_SCALE)
          : 0;
      return {
        amount,
        segment: {
          ...rowOf(parent),
          share,
          shareLabel: hasBar ? shareLabelOf(share) : null,
        },
      };
    });
  return {
    segments: segments.map(({ segment }) => segment),
    bar: hasBar
      ? segments
          .filter(({ amount }) => amount > 0n)
          .map(({ segment }) => segment)
      : null,
    moreRefundedThanSpent: parents
      .filter(({ amount }) => amount < 0n)
      .map(({ parent }) => rowOf(parent)),
    empty: parents.length === 0,
  };
}
