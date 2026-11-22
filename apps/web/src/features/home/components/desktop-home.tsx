import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { Arrival } from "@/features/home/components/home-arrival";
import { createHomeCategorySummary } from "@/features/home/home-category-summary";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { createCategoryBreakdown } from "@/features/reports/category-breakdown";
import { SpendingByCategory } from "@/features/reports/components/spending-by-category";
import { formatReportMonth } from "@/features/reports/report-month";
import { TransactionTable } from "@/features/transactions/components/transaction-table";
import { WalletTable } from "@/features/wallets/components/wallet-table";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { sectionLinkClass } from "@/shared/components/list-section";

type WalletCollection = components["schemas"]["WalletCollection"];
type ApiTransaction = components["schemas"]["Transaction"];

interface DesktopHomeProps {
  today: CalendarDate;
  walletCollection: Readonly<WalletCollection>;
  /** The Today and This month cards the phone strip also shows. */
  summaryCards: readonly [React.ReactNode, React.ReactNode];
  recent: readonly ApiTransaction[];
  savedId?: string;
  /** Whether the cards arrive one by one, as on the app's first showing. */
  arrive: boolean;
}

function archivedNote(count: number) {
  return `${count} archived ${count === 1 ? "wallet" : "wallets"} not shown`;
}

function CategoriesCard({ today }: Readonly<Pick<DesktopHomeProps, "today">>) {
  const { data } = useSuspenseQuery(
    createHomeQueryPlan(today).categorySpending,
  );
  const { breakdown, hiddenCount } = createHomeCategorySummary(
    createCategoryBreakdown(data),
  );
  const month = formatReportMonth(data.month);
  return (
    <DashboardCard
      headingId="home-categories-heading"
      heading="Spending by category"
      action={<span className="text-muted-foreground text-sm">{month}</span>}
    >
      <SpendingByCategory breakdown={breakdown} month={month} />
      {hiddenCount > 0 && (
        <Link
          to="/reports"
          search={{ month: data.month }}
          className={`${sectionLinkClass} mt-auto self-start`}
        >
          {hiddenCount} more {hiddenCount === 1 ? "category" : "categories"} in{" "}
          {month}
          <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />
        </Link>
      )}
    </DashboardCard>
  );
}

/**
 * Home from 1024px as a dashboard grid: the figures, then spending beside the
 * wallets, then the records as a table. The cards in a row share one height.
 */
export function DesktopHome({
  today,
  walletCollection,
  summaryCards,
  recent,
  savedId,
  arrive,
}: Readonly<DesktopHomeProps>) {
  const activeWallets = walletCollection.items.filter(
    (wallet) => !wallet.archivedAt,
  );
  const archivedCount = walletCollection.items.length - activeWallets.length;
  return (
    <>
      <DashboardRow className="lg:grid-cols-3">
        <Arrival order={0} animate={arrive}>
          <WalletsTotal balance={walletCollection.balance} lead="spendable" />
        </Arrival>
        <Arrival order={1} animate={arrive}>
          {summaryCards[0]}
        </Arrival>
        <Arrival order={2} animate={arrive}>
          {summaryCards[1]}
        </Arrival>
      </DashboardRow>
      <DashboardRow className="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Arrival order={3} animate={arrive}>
          <CategoriesCard today={today} />
        </Arrival>
        <Arrival order={4} animate={arrive}>
          <DashboardCard
            headingId="home-wallets-heading"
            heading="Wallets"
            action={
              <Link to="/wallets" className={sectionLinkClass}>
                All wallets
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Link>
            }
          >
            <WalletTable
              wallets={activeWallets}
              total={walletCollection.balance.total}
            />
            {archivedCount > 0 && (
              <p className="text-muted-foreground mt-auto text-sm">
                {archivedNote(archivedCount)}
              </p>
            )}
          </DashboardCard>
        </Arrival>
      </DashboardRow>
      <Arrival order={5} animate={arrive}>
        <DashboardCard
          headingId="recent-heading"
          heading="Recent transactions"
          action={
            recent.length > 0 && (
              <Link to="/transactions" className={sectionLinkClass}>
                All transactions
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Link>
            )
          }
        >
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">No transactions yet</p>
          ) : (
            <TransactionTable transactions={recent} savedId={savedId} />
          )}
        </DashboardCard>
      </Arrival>
    </>
  );
}
