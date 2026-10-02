import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { useState } from "react";
import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { ChartSwatch } from "@/shared/components/chart/chart-swatch";
import { Money } from "@/shared/components/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toPercent } from "@/shared/helpers/bar-scale";
import type { BalanceDay, BalancePoint, BalanceTrend } from "../balance-trend";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletComparison {
  /** Every wallet the owner holds, archived ones included. */
  wallets: readonly WalletSummary[];
  /** The wallet drawn beside the total; none by default. */
  comparedWalletId: string | undefined;
  onCompareWallet: (walletId: string | undefined) => void;
}

interface BalanceOverTimeProps extends WalletComparison {
  trend: Readonly<BalanceTrend>;
  /** The chosen month, already formatted, such as "September 2026". */
  month: string;
}

const NO_WALLETS_OPEN = "No wallets open";
const NOT_OPEN_YET = "Not open yet";
const NO_COMPARISON = "None";

/** Plot coordinates: x across 0–100, y down from the top. */
function plotPoint(point: Readonly<BalancePoint>): string {
  return `${point.x * 100},${(1 - point.y) * 100}`;
}

/** The wash beneath a run: down to the plot's floor at both ends. */
function washPoints(run: readonly BalancePoint[]): string {
  const first = run[0];
  const last = run.at(-1);
  if (!first || !last) {
    return "";
  }
  return [
    `${first.x * 100},100`,
    ...run.map(plotPoint),
    `${last.x * 100},100`,
  ].join(" ");
}

function moneyText(money: Readonly<ApiMoney>): string {
  return formatMoney({
    amountInMinorUnits: parseApiMoney(money),
    currency: money.currency,
  });
}

/** What the slider announces for a day: its date, the total, and the compared wallet's figure. */
function dayText(
  day: Readonly<BalanceDay>,
  walletName: string | undefined,
): string {
  const total = day.total === null ? NO_WALLETS_OPEN : moneyText(day.total);
  const parts = [formatCalendarDate(day.date), `Total ${total}`];
  if (walletName !== undefined) {
    const wallet = day.wallet ? moneyText(day.wallet) : NOT_OPEN_YET;
    parts.push(`${walletName} ${wallet}`);
  }
  return parts.join(", ");
}

interface WalletFigureProps {
  money: ApiMoney | null | undefined;
}

/** The compared wallet's figure on a day: its balance, or that it had not opened. */
function WalletFigure({ money }: Readonly<WalletFigureProps>) {
  return money ? <Money amount={money} /> : NOT_OPEN_YET;
}

interface ArchivedMarkProps {
  wallet: Readonly<WalletSummary>;
  className: string;
}

function ArchivedMark({ wallet, className }: Readonly<ArchivedMarkProps>) {
  return wallet.archivedAt ? (
    <span className={className}> · Archived</span>
  ) : null;
}

/**
 * Chooses the one wallet drawn beside the total. "None" is a real, selectable
 * first item, so the comparison is cleared from the same list that set it.
 */
function WalletPicker({
  wallets,
  comparedWalletId,
  onCompareWallet,
}: Readonly<WalletComparison>) {
  const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  return (
    <div className="flex min-w-0 flex-col gap-2 font-medium text-sm sm:max-w-xs">
      <label htmlFor="compare-wallet">Compare a wallet</label>
      <Select
        value={comparedWalletId ?? null}
        onValueChange={(value: string | null) => {
          onCompareWallet(value ?? undefined);
        }}
      >
        <SelectTrigger id="compare-wallet">
          <SelectValue>
            {(selected: string | null) => {
              const wallet = selected ? byId.get(selected) : undefined;
              if (!wallet) {
                return NO_COMPARISON;
              }
              return (
                <>
                  <span className="truncate">{wallet.name}</span>
                  <ArchivedMark
                    wallet={wallet}
                    className="shrink-0 text-muted-foreground"
                  />
                </>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null} label={NO_COMPARISON}>
            {NO_COMPARISON}
          </SelectItem>
          <SelectSeparator />
          {wallets.map((wallet) => (
            <SelectItem key={wallet.id} value={wallet.id} label={wallet.name}>
              {/* Wraps, so a long name keeps its Archived mark in a narrow column. */}
              <span className="wrap-break-word">
                {wallet.name}
                <ArchivedMark
                  wallet={wallet}
                  className="font-normal text-muted-foreground"
                />
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const PAGE_DAYS = 7;

/**
 * The level 3 balance trend: the total Closing balance across the month as
 * one line, from the earliest opening date to the last day read, with one
 * chosen wallet optionally drawn beside it as a dashed line. The plot is a
 * slider over the days with a total, so the selected day can be moved by
 * pointer or keys, and its exact figures are read out beneath; a table
 * carries every day for assistive technology.
 */
export function BalanceOverTime({
  trend,
  month,
  ...comparison
}: Readonly<BalanceOverTimeProps>) {
  if (trend.kind === "future") {
    return (
      <p className="text-muted-foreground text-sm">Nothing yet in {month}.</p>
    );
  }
  if (trend.kind === "untracked") {
    return (
      <p className="text-muted-foreground text-sm">
        No wallets were open in {month}.
      </p>
    );
  }
  return <BalanceLine trend={trend} month={month} {...comparison} />;
}

interface BalanceLineProps extends WalletComparison {
  trend: Readonly<Extract<BalanceTrend, { kind: "line" }>>;
  month: string;
}

function BalanceLine({
  trend,
  month,
  ...comparison
}: Readonly<BalanceLineProps>) {
  const [selectedDate, setSelectedDate] = useState(trend.selected);
  const points = trend.runs.flat();
  const selectedIndex = Math.max(
    points.findIndex((point) => point.date === selectedDate),
    0,
  );
  const selectedPoint = points[selectedIndex];
  const selectedDay = trend.days.find((day) => day.date === selectedDate);
  const selectedWalletPoint = trend.walletRuns
    .flat()
    .find((point) => point.date === selectedDate);
  // The wallet's figures arrive with its read; until then the total stands alone.
  const comparedWallet = trend.days.some((day) => day.wallet !== undefined)
    ? comparison.wallets.find(
        (wallet) => wallet.id === comparison.comparedWalletId,
      )
    : undefined;

  function select(index: number) {
    const point = points[Math.min(Math.max(index, 0), points.length - 1)];
    if (point) {
      setSelectedDate(point.date);
    }
  }

  /** The day nearest the pointer, among the days with a balance. */
  function selectAt(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    let nearest = 0;
    for (const [index, point] of points.entries()) {
      if (Math.abs(point.x - x) < Math.abs(points[nearest].x - x)) {
        nearest = index;
      }
    }
    select(nearest);
  }

  // How far each slider key moves the selected day; Home and End overshoot to the ends.
  const keySteps = new Map([
    ["ArrowLeft", -1],
    ["ArrowDown", -1],
    ["ArrowRight", 1],
    ["ArrowUp", 1],
    ["PageDown", -PAGE_DAYS],
    ["PageUp", PAGE_DAYS],
    ["Home", -points.length],
    ["End", points.length],
  ]);

  return (
    <div className="flex flex-col gap-4">
      <WalletPicker {...comparison} />
      {/* A table ignores the clip of its own sr-only, so a wrapper holds it. */}
      <div className="sr-only">
        <table>
          <caption>
            {comparedWallet
              ? `Total and ${comparedWallet.name} closing balance for each day of ${month}`
              : `Total closing balance for each day of ${month}`}
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Total balance</th>
              {comparedWallet && <th scope="col">{comparedWallet.name}</th>}
            </tr>
          </thead>
          <tbody>
            {trend.days.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatCalendarDate(day.date)}</th>
                <td>
                  {day.total === null ? (
                    NO_WALLETS_OPEN
                  ) : (
                    <Money amount={day.total} />
                  )}
                </td>
                {comparedWallet && (
                  <td>
                    <WalletFigure money={day.wallet} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Selected day"
        aria-valuemin={1}
        aria-valuemax={points.length}
        aria-valuenow={selectedIndex + 1}
        aria-valuetext={
          selectedDay ? dayText(selectedDay, comparedWallet?.name) : undefined
        }
        onKeyDown={(event) => {
          const step = keySteps.get(event.key);
          if (step !== undefined) {
            event.preventDefault();
            select(selectedIndex + step);
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          selectAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            selectAt(event);
          }
        }}
        className="relative h-44 cursor-pointer touch-pan-y rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          {trend.runs.map((run) => (
            <g key={run[0]?.date}>
              <polygon points={washPoints(run)} className="fill-border" />
              <polyline
                points={run.map(plotPoint).join(" ")}
                vectorEffect="non-scaling-stroke"
                className="fill-none stroke-2 stroke-chart-1 [stroke-linecap:round] [stroke-linejoin:round]"
              />
            </g>
          ))}
          {comparedWallet &&
            trend.walletRuns.map((run) => (
              <polyline
                key={run[0]?.date}
                data-wallet-line
                points={run.map(plotPoint).join(" ")}
                vectorEffect="non-scaling-stroke"
                className="fill-none stroke-2 stroke-chart-2 [stroke-dasharray:6_4] [stroke-linejoin:round]"
              />
            ))}
        </svg>
        {trend.zero !== null && (
          <div
            data-zero-line
            className="pointer-events-none absolute inset-x-0 h-px bg-chart-baseline"
            style={{ bottom: toPercent(trend.zero) }}
          />
        )}
        {selectedPoint && (
          <div
            aria-hidden="true"
            data-selected-day={selectedPoint.date}
            className="pointer-events-none absolute size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-1"
            style={{
              left: toPercent(selectedPoint.x),
              bottom: toPercent(selectedPoint.y),
            }}
          />
        )}
        {comparedWallet && selectedWalletPoint && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-chart-2"
            style={{
              left: toPercent(selectedWalletPoint.x),
              bottom: toPercent(selectedWalletPoint.y),
            }}
          />
        )}
      </div>
      <div
        aria-live="polite"
        className="flex flex-col gap-2.5 border-t pt-4"
        data-balance-readout
      >
        <p className="font-semibold text-sm">
          {selectedDay ? formatCalendarDate(selectedDay.date) : null}
        </p>
        <dl className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2 text-muted-foreground text-sm">
            <ChartSwatch series="balance" />
            Total balance
          </dt>
          <dd>
            {selectedDay?.total ? (
              <Money amount={selectedDay.total} />
            ) : (
              NO_WALLETS_OPEN
            )}
          </dd>
        </dl>
        {comparedWallet && (
          <dl className="flex items-baseline justify-between gap-3">
            <dt className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
              <ChartSwatch series="compared" />
              <span className="truncate">{comparedWallet.name}</span>
            </dt>
            <dd className="shrink-0">
              <WalletFigure money={selectedDay?.wallet} />
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}
