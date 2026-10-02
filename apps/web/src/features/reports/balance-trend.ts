import type { CalendarDate } from "@bookkeeping/domain/dates";
import { addDays } from "@bookkeeping/domain/dates";
import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";

type ClosingBalances = components["schemas"]["ClosingBalances"];

export interface BalanceDay {
  date: CalendarDate;
  /** The total Closing balance, exactly as read; null before any wallet opened. */
  total: ApiMoney | null;
}

export interface BalancePoint {
  date: CalendarDate;
  /** Where the day sits across the whole month, from 0 at its first day to 1 at its last. */
  x: number;
  /** Where the balance sits up the plot, from 0 at the bottom to 1 at the top. */
  y: number;
}

export type BalanceTrend =
  /** The month has not started yet. */
  | { kind: "future" }
  /** No wallet was open on any day of the month. */
  | { kind: "untracked" }
  | {
      kind: "line";
      /** Every day the server returned, oldest first, for the readout and table. */
      days: BalanceDay[];
      /** Stretches of consecutive days with a balance; a gap is a day without one. */
      runs: BalancePoint[][];
      /** Where the zero line sits up the plot; null when no balance in view is negative. */
      zero: number | null;
      /** The day read out first. */
      selected: CalendarDate;
    };

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** Where a day of the month sits across the plot. */
function xOf(date: CalendarDate, monthLength: number): number {
  return (Number(date.slice(8, 10)) - 1) / (monthLength - 1);
}

/**
 * The balance trend for one month's closing balances: the plot spans the
 * month's lowest to highest balance, so a dip shows, and reaches up to zero
 * when a balance in view is negative, so the zero line can be drawn. The
 * selected day is the Balance date when the month has a balance for it,
 * otherwise the last day that has one.
 */
export function createBalanceTrend(
  balances: Readonly<ClosingBalances>,
  balanceDate: CalendarDate,
): BalanceTrend {
  if (balances.entries.length === 0) {
    return { kind: "future" };
  }
  const days: BalanceDay[] = balances.entries;
  const tracked = days.flatMap((day) =>
    day.total === null
      ? []
      : [{ date: day.date, total: parseApiMoney(day.total) }],
  );
  const lastTracked = tracked.at(-1);
  if (!lastTracked) {
    return { kind: "untracked" };
  }

  const lowest = tracked.reduce(
    (low, day) => (day.total < low ? day.total : low),
    lastTracked.total,
  );
  const highest = tracked.reduce(
    (high, day) => (day.total > high ? day.total : high),
    lowest < 0n ? 0n : lastTracked.total,
  );
  const span = Number(highest - lowest);
  function yOf(amount: bigint): number {
    return span === 0 ? 0.5 : Number(amount - lowest) / span;
  }
  const monthLength = daysInMonth(balances.month);

  const runs: BalancePoint[][] = [];
  let previous: CalendarDate | undefined;
  for (const day of tracked) {
    const point = {
      date: day.date,
      x: xOf(day.date, monthLength),
      y: yOf(day.total),
    };
    const run = runs.at(-1);
    if (run && previous && addDays(previous, 1) === day.date) {
      run.push(point);
    } else {
      runs.push([point]);
    }
    previous = day.date;
  }

  return {
    kind: "line",
    days,
    runs,
    zero: lowest < 0n ? yOf(0n) : null,
    selected: tracked.some((day) => day.date === balanceDate)
      ? balanceDate
      : lastTracked.date,
  };
}
