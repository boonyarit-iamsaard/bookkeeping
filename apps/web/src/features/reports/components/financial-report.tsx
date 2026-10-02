import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { totalWalletBalance } from "@/features/wallets/wallet-total";
import { FlowBars } from "@/shared/components/chart/flow-bars";
import type { WalletShare } from "@/shared/components/chart/wallet-share-chart";
import { WalletShareChart } from "@/shared/components/chart/wallet-share-chart";
import { DisplayFigure } from "@/shared/components/display-figure";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import type { BalanceTrend } from "../balance-trend";
import type { CategoryBreakdown } from "../category-breakdown";
import type { ReportFigure } from "../report-labels";
import { REPORT_FIGURE_LABELS } from "../report-labels";
import { formatReportMonth } from "../report-month";
import type { TrendPoint } from "../trend-series";
import { BalanceOverTime } from "./balance-over-time";
import { SpendingByCategory } from "./spending-by-category";
import { TrendChart } from "./trend-chart";

type MonthlyReport = components["schemas"]["MonthlyReport"];
type WalletSummary = components["schemas"]["Wallet"];
type ApiMoney = components["schemas"]["Money"];

interface FinancialReportProps {
  summary: Readonly<MonthlyReport>;
  categoryBreakdown: Readonly<CategoryBreakdown>;
  balanceTrend: Readonly<BalanceTrend>;
  /** The wallet drawn beside the total; none by default. */
  comparedWalletId: string | undefined;
  onCompareWallet: (walletId: string | undefined) => void;
  currentWallets: readonly WalletSummary[];
  datedWallets: readonly WalletSummary[];
  asOf: CalendarDate;
  trend: readonly TrendPoint[];
  /** The Balance date control, shown with the balances it dates. */
  balanceDate: React.ReactNode;
}

const CARD_CLASS =
  "flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card sm:p-6";
const CARD_HEADING_CLASS = "font-bold text-lg tracking-tight";

const SUMMARY_FIGURES = [
  "income",
  "grossExpenses",
  "refunds",
  "netExpenses",
  "net",
] as const satisfies readonly ReportFigure[];

export function FinancialReport({
  summary,
  categoryBreakdown,
  balanceTrend,
  comparedWalletId,
  onCompareWallet,
  currentWallets,
  datedWallets,
  asOf,
  trend,
  balanceDate,
}: Readonly<FinancialReportProps>) {
  const currentTotal = totalWalletBalance(currentWallets);
  const datedTotal = totalWalletBalance(datedWallets);

  const shares: WalletShare[] = currentWallets.map((wallet) => ({
    wallet,
    balance: datedBalanceOf(wallet, datedWallets),
  }));
  const month = formatReportMonth(summary.month);

  return (
    <>
      <DisplayFigure
        amount={summary.net}
        heading="Net"
        headingId="report-net-heading"
        caption={`${month} · income − net expenses`}
      />
      <section aria-labelledby="monthly-totals-heading" className={CARD_CLASS}>
        <h2 id="monthly-totals-heading" className={CARD_HEADING_CLASS}>
          {month}
        </h2>
        {summary.transactionCount > 0 && (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">Income against net expenses</legend>
            <FlowBars
              income={summary.income}
              netExpenses={summary.netExpenses}
              showAmounts={false}
            />
          </fieldset>
        )}
        <dl className="divide-y divide-border/70">
          {SUMMARY_FIGURES.map((key) => (
            <div
              key={key}
              data-summary={key}
              className={`flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0 ${key === "net" ? "font-semibold" : ""}`}
            >
              <dt>{REPORT_FIGURE_LABELS[key]}</dt>
              <dd>
                <Money amount={summary[key]} className="text-lg" />
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm leading-normal">
          Net expenses = gross expenses − refunds. Net = income − net expenses.
          Openings and transfers are excluded; refunds count in their own month.
        </p>
        {summary.transactionCount === 0 && (
          <p className="text-muted-foreground text-sm">
            No income, expenses or refunds recorded this month.
          </p>
        )}
      </section>
      <section
        aria-labelledby="category-spending-heading"
        className={CARD_CLASS}
      >
        <h2 id="category-spending-heading" className={CARD_HEADING_CLASS}>
          Spending by category
        </h2>
        <SpendingByCategory breakdown={categoryBreakdown} month={month} />
      </section>
      <section aria-labelledby="trend-heading" className={CARD_CLASS}>
        <h2 id="trend-heading" className={CARD_HEADING_CLASS}>
          Last six months
        </h2>
        <TrendChart key={summary.month} points={trend} />
      </section>
      <section aria-labelledby="wallet-balances-heading" className={CARD_CLASS}>
        <h2 id="wallet-balances-heading" className={CARD_HEADING_CLASS}>
          Wallet balances
        </h2>
        {balanceDate}
        <p className="text-muted-foreground text-sm">
          End of day {formatCalendarDate(asOf)} · Bangkok. Archived holdings are
          included; wallets contribute nothing before opening.
        </p>
        {currentWallets.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p>Add a wallet to begin tracking balances.</p>
            <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
              Create wallet
            </Link>
          </div>
        ) : (
          <>
            <WalletShareChart shares={shares} />
            <p
              data-share-total
              className="flex flex-wrap items-baseline justify-between gap-x-3 border-t pt-4 font-semibold"
            >
              Total
              <Money amount={datedTotal} className="text-lg" />
            </p>
            <dl className="divide-y divide-border/70 border-t">
              <BalanceRow
                name="Overall balance"
                current={currentTotal}
                dated={datedTotal}
                asOf={asOf}
              />
              {shares.map(({ wallet, balance }) => (
                <BalanceRow
                  key={wallet.id}
                  name={wallet.name}
                  walletId={wallet.id}
                  archived={Boolean(wallet.archivedAt)}
                  current={wallet.balance}
                  asOf={asOf}
                  dated={balance}
                />
              ))}
            </dl>
          </>
        )}
      </section>
      <section aria-labelledby="balance-trend-heading" className={CARD_CLASS}>
        <h2 id="balance-trend-heading" className={CARD_HEADING_CLASS}>
          Balance over time
        </h2>
        <BalanceOverTime
          key={`${summary.month} ${asOf}`}
          trend={balanceTrend}
          month={month}
          wallets={currentWallets}
          comparedWalletId={comparedWalletId}
          onCompareWallet={onCompareWallet}
        />
      </section>
    </>
  );
}

/** A wallet's balance at the report's date; zero when it did not yet exist. */
function datedBalanceOf(
  wallet: Readonly<WalletSummary>,
  datedWallets: readonly WalletSummary[],
): ApiMoney {
  return (
    datedWallets.find((dated) => dated.id === wallet.id)?.balance ?? {
      value: "0.00",
      currency: "THB",
    }
  );
}

interface BalanceRowProps {
  name: string;
  walletId?: string;
  archived?: boolean;
  current: ApiMoney;
  /** The balance at the end of `asOf`. */
  dated: ApiMoney;
  asOf: CalendarDate;
}

function BalanceRow({
  name,
  walletId,
  archived,
  current,
  dated,
  asOf,
}: Readonly<BalanceRowProps>) {
  return (
    <div
      data-balance-row={name}
      className="flex flex-col gap-3 py-4 first:pt-4"
    >
      <dt className="font-medium">
        {walletId ? (
          <Link
            to="/wallets/$walletId"
            params={{ walletId }}
            className="inline-flex min-h-11 min-w-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {name}
          </Link>
        ) : (
          name
        )}
        {archived && (
          <span className="text-muted-foreground text-sm"> · Archived</span>
        )}
      </dt>
      <dd className="grid grid-cols-2 gap-x-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground text-sm">Current</span>
          <Money amount={current} />
        </span>
        {/* The date column says something only when it differs from Current. */}
        {current.value !== dated.value && (
          <span
            data-balance-total={walletId ? undefined : true}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <span className="text-muted-foreground text-sm">
              {formatCalendarDate(asOf)}
            </span>
            <Money amount={dated} />
          </span>
        )}
      </dd>
    </div>
  );
}
