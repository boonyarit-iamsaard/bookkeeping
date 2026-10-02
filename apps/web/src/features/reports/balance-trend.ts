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
  /**
   * The compared wallet's Closing balance, exactly as read; null before its
   * opening date, absent when no wallet is compared.
   */
  wallet?: ApiMoney | null;
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
      /** The compared wallet's runs, gapped on its own; none when no wallet is compared. */
      walletRuns: BalancePoint[][];
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

interface TrackedDay {
  date: CalendarDate;
  amount: bigint;
}

/** The days a series has a figure for, as exact amounts. */
function trackedDays(
  days: readonly BalanceDay[],
  figure: (day: Readonly<BalanceDay>) => ApiMoney | null | undefined,
): TrackedDay[] {
  return days.flatMap((day) => {
    const money = figure(day);
    return money ? [{ date: day.date, amount: parseApiMoney(money) }] : [];
  });
}

/** Splits a series into stretches of consecutive days; a missing day is a gap. */
function runsOf(
  tracked: readonly TrackedDay[],
  place: (day: Readonly<TrackedDay>) => BalancePoint,
): BalancePoint[][] {
  const runs: BalancePoint[][] = [];
  let previous: CalendarDate | undefined;
  for (const day of tracked) {
    const point = place(day);
    const run = runs.at(-1);
    if (run && previous && addDays(previous, 1) === day.date) {
      run.push(point);
    } else {
      runs.push([point]);
    }
    previous = day.date;
  }
  return runs;
}

/**
 * The balance trend for one month's closing balances: the plot spans the
 * month's lowest to highest balance across the total and the compared
 * wallet, so a dip in either shows, and reaches up to zero when a balance in
 * view is negative, so the zero line can be drawn. The selected day is the
 * Balance date when the month has a total for it, otherwise the last day
 * that has one.
 */
export function createBalanceTrend(
  balances: Readonly<ClosingBalances>,
  balanceDate: CalendarDate,
): BalanceTrend {
  if (balances.entries.length === 0) {
    return { kind: "future" };
  }
  const days: BalanceDay[] = balances.entries;
  const tracked = trackedDays(days, (day) => day.total);
  const lastTracked = tracked.at(-1);
  if (!lastTracked) {
    return { kind: "untracked" };
  }
  const walletTracked = trackedDays(days, (day) => day.wallet);

  const inView = [...tracked, ...walletTracked];
  const lowest = inView.reduce(
    (low, day) => (day.amount < low ? day.amount : low),
    lastTracked.amount,
  );
  const highest = inView.reduce(
    (high, day) => (day.amount > high ? day.amount : high),
    lowest < 0n ? 0n : lastTracked.amount,
  );
  const span = Number(highest - lowest);
  function yOf(amount: bigint): number {
    return span === 0 ? 0.5 : Number(amount - lowest) / span;
  }
  const monthLength = daysInMonth(balances.month);
  function place(day: Readonly<TrackedDay>): BalancePoint {
    return {
      date: day.date,
      x: xOf(day.date, monthLength),
      y: yOf(day.amount),
    };
  }

  return {
    kind: "line",
    days,
    runs: runsOf(tracked, place),
    walletRuns: runsOf(walletTracked, place),
    zero: lowest < 0n ? yOf(0n) : null,
    selected: tracked.some((day) => day.date === balanceDate)
      ? balanceDate
      : lastTracked.date,
  };
}
