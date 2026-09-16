import { formatCalendarDate } from "@bookkeeping/domain/dates";
import type { MonthlySummary } from "@bookkeeping/domain/transactions";
import type { WalletSummary } from "@bookkeeping/domain/wallets";
import Link from "next/link";
import { Money } from "@/features/wallets/components/money";
import { buttonVariants } from "@/shared/components/ui/button";

interface FinancialReportProps {
  summary: Readonly<MonthlySummary>;
  currentWallets: readonly WalletSummary[];
  datedWallets: readonly WalletSummary[];
  asOf: string;
}

const SUMMARY_ROWS = [
  { key: "income", label: "Income" },
  { key: "grossExpenses", label: "Gross expenses" },
  { key: "refunds", label: "Refunds" },
  { key: "netExpenses", label: "Net expenses" },
  { key: "net", label: "Net" },
] as const;

export function FinancialReport({
  summary,
  currentWallets,
  datedWallets,
  asOf,
}: Readonly<FinancialReportProps>) {
  const currentTotal = currentWallets.reduce(
    (total, wallet) => total + wallet.balance,
    0n,
  );
  const datedTotal = datedWallets.reduce(
    (total, wallet) => total + wallet.balance,
    0n,
  );
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
          {SUMMARY_ROWS.map(({ key, label }) => (
            <div
              key={key}
              data-summary={key}
              className={`flex flex-wrap items-center justify-between gap-3 py-4 ${key === "net" ? "font-semibold" : ""}`}
            >
              <dt>{label}</dt>
              <dd>
                <Money
                  amountInMinorUnits={summary[key]}
                  currency="THB"
                  className="text-lg"
                />
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
            <Link
              href="/wallets/new"
              className={buttonVariants({ size: "lg" })}
            >
              Create wallet
            </Link>
          </div>
        ) : (
          <dl className="divide-y">
            <BalanceRow
              name="Overall balance"
              current={currentTotal}
              selected={datedTotal}
            />
            {currentWallets.map((wallet) => (
              <BalanceRow
                key={wallet.id}
                name={wallet.name}
                href={`/wallets/${wallet.id}`}
                archived={Boolean(wallet.archivedAt)}
                current={wallet.balance}
                selected={
                  datedWallets.find((dated) => dated.id === wallet.id)
                    ?.balance ?? 0n
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
  href?: string;
  archived?: boolean;
  current: bigint;
  selected: bigint;
}

function BalanceRow({
  name,
  href,
  archived,
  current,
  selected,
}: Readonly<BalanceRowProps>) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <dt className="font-medium">
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
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
          <Money amountInMinorUnits={current} currency="THB" />
        </span>
        <span
          data-balance-total={!href || undefined}
          className="flex flex-wrap items-baseline justify-between gap-2"
        >
          <span className="text-muted-foreground text-sm">Selected date</span>
          <Money amountInMinorUnits={selected} currency="THB" />
        </span>
      </dd>
    </div>
  );
}
