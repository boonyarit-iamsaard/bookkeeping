import type { CalendarDate } from "@bookkeeping/domain/dates";
import type { BalanceDay, BalancePoint, BalanceTrend } from "./balance-trend";

export interface BalanceSelectionMemory {
  month: string;
  balanceDate: CalendarDate;
  date?: CalendarDate;
}

export interface SelectedBalanceDay {
  index: number;
  day: BalanceDay;
  point: BalancePoint;
  walletPoint?: BalancePoint;
}

export interface BalanceSelection {
  memory: BalanceSelectionMemory;
  points: readonly BalancePoint[];
  selected?: SelectedBalanceDay;
}

export interface ResolveBalanceSelectionOptions {
  month: string;
  balanceDate: CalendarDate;
  trend: Readonly<BalanceTrend>;
  previous?: Readonly<BalanceSelectionMemory>;
}

export type BalanceSelectionMovement =
  | { type: "key"; key: string }
  | { type: "pointer"; position: number };

const KEY_STEPS = new Map([
  ["ArrowLeft", -1],
  ["ArrowDown", -1],
  ["ArrowRight", 1],
  ["ArrowUp", 1],
  ["PageDown", -7],
  ["PageUp", 7],
  ["Home", Number.NEGATIVE_INFINITY],
  ["End", Number.POSITIVE_INFINITY],
]);

export function isBalanceSelectionKey(key: string): boolean {
  return KEY_STEPS.has(key);
}

/** Gesture policy over tracked totals; the browser supplies normalized x. */
export function moveBalanceSelection(
  selection: Readonly<BalanceSelection>,
  movement: Readonly<BalanceSelectionMovement>,
): BalanceSelectionMemory {
  const { points, selected, memory } = selection;
  if (!selected) {
    return memory;
  }
  let index = selected.index;
  if (movement.type === "key") {
    index = Math.min(
      Math.max(index + (KEY_STEPS.get(movement.key) ?? 0), 0),
      points.length - 1,
    );
  } else if (Number.isFinite(movement.position)) {
    index = 0;
    for (const [candidate, point] of points.entries()) {
      if (
        Math.abs(point.x - movement.position) <
        Math.abs(points[index].x - movement.position)
      ) {
        index = candidate;
      }
    }
  }
  return { ...memory, date: points[index]?.date };
}

/** Resolve one tracked day for every figure; fallback becomes the new choice. */
export function resolveBalanceSelection({
  month,
  balanceDate,
  trend,
  previous,
}: Readonly<ResolveBalanceSelectionOptions>): BalanceSelection {
  const memory: BalanceSelectionMemory = { month, balanceDate };
  if (trend.kind !== "line") {
    return { memory, points: [] };
  }
  const points = trend.runs.flat();
  const retainedDate =
    previous?.month === month && previous.balanceDate === balanceDate
      ? previous.date
      : undefined;
  const retainedIndex = points.findIndex(
    (point) => point.date === retainedDate,
  );
  const index =
    retainedIndex >= 0
      ? retainedIndex
      : points.findIndex((point) => point.date === trend.selected);
  const point = points[index];
  const day = point && trend.days.find((entry) => entry.date === point.date);
  if (!point || !day) {
    return { memory, points };
  }
  return {
    memory: { ...memory, date: day.date },
    points,
    selected: {
      index,
      day,
      point,
      walletPoint: trend.walletRuns
        .flat()
        .find((entry) => entry.date === day.date),
    },
  };
}
