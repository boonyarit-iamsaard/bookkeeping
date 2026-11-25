import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney, presentApiMoney } from "@/core/api/money";
import type { CategoryColor } from "@/features/categories/category-color";
import { parentCategoryColor } from "@/features/categories/category-color";
import type { CategorySpending } from "@/features/reports/category-breakdown";

/** Home's card fits this many parents; Reports holds the rest. */
const HOME_CATEGORY_LIMIT = 6;
/** Bar lengths are exact to a millionth before they become widths. */
const SHARE_SCALE = 1_000_000n;

export interface CategoryComparisonRow {
  id: string;
  name: string;
  isUncategorized: boolean;
  color: CategoryColor;
  current: ApiMoney;
  previous: ApiMoney;
  /** Each month's bar as a fraction of the largest shown, 0 when not above zero. */
  currentShare: number;
  previousShare: number;
}

export interface CategoryComparison {
  /** Parents spent on in either month, this month's largest first, then last month's. */
  rows: CategoryComparisonRow[];
  /** Parents left for Reports. */
  hiddenCount: number;
}

type Parent = CategorySpending["parents"][number];

function compareDescending(first: bigint, second: bigint) {
  return first === second ? 0 : first > second ? -1 : 1;
}

/** This month's Category spending beside last month's, parent by parent. */
export function compareCategorySpending(
  current: Readonly<CategorySpending>,
  previous: Readonly<CategorySpending>,
): CategoryComparison {
  const zero = presentApiMoney({
    amountInMinorUnits: 0n,
    currency: current.netExpenses.currency,
  });
  const byId = new Map<
    string,
    { parent: Parent; current: ApiMoney; previous: ApiMoney }
  >();
  for (const parent of previous.parents) {
    byId.set(parent.id, { parent, current: zero, previous: parent.spending });
  }
  for (const parent of current.parents) {
    byId.set(parent.id, {
      parent,
      current: parent.spending,
      previous: byId.get(parent.id)?.previous ?? zero,
    });
  }
  const ranked = [...byId.values()]
    .map((entry) => ({
      ...entry,
      currentAmount: parseApiMoney(entry.current),
      previousAmount: parseApiMoney(entry.previous),
    }))
    .toSorted(
      (first, second) =>
        compareDescending(first.currentAmount, second.currentAmount) ||
        compareDescending(first.previousAmount, second.previousAmount) ||
        Number(first.parent.isUncategorized) -
          Number(second.parent.isUncategorized) ||
        first.parent.sortOrder - second.parent.sortOrder,
    );
  const shown = ranked.slice(0, HOME_CATEGORY_LIMIT);
  // Bigints, so no Math.max: the largest amount either month shows.
  let scale = 0n;
  for (const row of shown) {
    for (const amount of [row.currentAmount, row.previousAmount]) {
      if (amount > scale) {
        scale = amount;
      }
    }
  }
  function shareOf(amount: bigint) {
    return scale > 0n && amount > 0n
      ? Number((amount * SHARE_SCALE) / scale) / Number(SHARE_SCALE)
      : 0;
  }
  return {
    rows: shown.map(({ parent, current, previous, ...amounts }) => ({
      id: parent.id,
      name: parent.name,
      isUncategorized: parent.isUncategorized,
      color: parentCategoryColor({
        id: parent.id,
        isProtected: parent.isUncategorized,
      }),
      current,
      previous,
      currentShare: shareOf(amounts.currentAmount),
      previousShare: shareOf(amounts.previousAmount),
    })),
    hiddenCount: ranked.length - shown.length,
  };
}
