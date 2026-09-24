import type { CalendarDate } from "@bookkeeping/domain/dates";
import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { totalWalletBalance } from "@/features/wallets/wallet-total";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import type { ReportFigure } from "../report-labels";
import { REPORT_FIGURE_LABELS } from "../report-labels";

type MonthlyReport = components["schemas"]["MonthlyReport"];
type WalletSummary = components["schemas"]["Wallet"];
type ApiMoney = components["schemas"]["Money"];

interface FinancialReportProps {
  summary: Readonly<MonthlyReport>;
  currentWallets: readonly WalletSummary[];
  datedWallets: readonly WalletSummary[];
  asOf: CalendarDate;
}

const SUMMARY_FIGURES = [
  "income",
  "grossExpenses",
  "refunds",
  "netExpenses",
  "net",
] as const satisfies readonly ReportFigure[];

export function FinancialReport({
  summary,
  currentWallets,
  datedWallets,
  asOf,
}: Readonly<FinancialReportProps>) {
  const currentTotal = totalWalletBalance(currentWallets);
  const datedTotal = totalWalletBalance(datedWallets);

  return (
    <>
      <section
        aria-labelledby="monthly-totals-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="monthly-totals-heading" className="font-semibold text-lg">
          {new Intl.DateTimeFormat("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(`${summary.month}-01T00:00:00Z`))}
        </h2>
        <dl className="divide-y">
          {SUMMARY_FIGURES.map((key) => (
            <div
              key={key}
              data-summary={key}
              className={`flex flex-wrap items-center justify-between gap-3 py-4 ${key === "net" ? "font-semibold" : ""}`}
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
        aria-labelledby="wallet-balances-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="wallet-balances-heading" className="font-semibold text-lg">
          Wallet balances
        </h2>
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
          <dl className="divide-y">
            <BalanceRow
              name="Overall balance"
              current={currentTotal}
              dated={datedTotal}
              asOf={asOf}
            />
            {currentWallets.map((wallet) => (
              <BalanceRow
                key={wallet.id}
                name={wallet.name}
                walletId={wallet.id}
                archived={Boolean(wallet.archivedAt)}
                current={wallet.balance}
                asOf={asOf}
                dated={
                  datedWallets.find((dated) => dated.id === wallet.id)
                    ?.balance ?? { value: "0.00", currency: "THB" }
                }
              />
            ))}
          </dl>
        )}
      </section>
    </>
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
    <div data-balance-row={name} className="flex flex-col gap-3 py-4">
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
      <dd className="grid gap-3 sm:grid-cols-2">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-muted-foreground text-sm">Current</span>
          <Money amount={current} />
        </span>
        <span
          data-balance-total={walletId ? undefined : true}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <span className="text-muted-foreground text-sm">
            {formatCalendarDate(asOf)}
          </span>
          <Money amount={dated} />
        </span>
      </dd>
    </div>
  );
}
