import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { Arrival } from "@/features/home/components/home-arrival";
import {
  HomeLoading,
  SummarySkeleton,
} from "@/features/home/components/home-loading";
import { MonthCard, TodayCard } from "@/features/home/components/period-cards";
import { createHomeCategorySummary } from "@/features/home/home-category-summary";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { useHomeReads } from "@/features/home/hooks/use-home-reads";
import { createCategoryBreakdown } from "@/features/reports/category-breakdown";
import { SpendingByCategory } from "@/features/reports/components/spending-by-category";
import { formatReportMonth } from "@/features/reports/report-month";
import { TransactionTable } from "@/features/transactions/components/transaction-table";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletTable } from "@/features/wallets/components/wallet-table";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { sectionLinkClass } from "@/shared/components/list-section";
import { HeroSkeleton, TableCardSkeleton } from "@/shared/components/skeleton";
import { pluralize } from "@/shared/helpers/pluralize";

interface HomeDesktopProps {
  initialToday: CalendarDate;
  savedId?: string;
}

interface CategoriesCardProps {
  today: CalendarDate;
}

// The figures in thirds, then spending beside the wallets, 5 + 7 of twelve.
const FIGURES_ROW = "grid-cols-3";
const SPENDING_ROW = "grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";

function LinkArrow() {
  return <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />;
}

function CategoriesCard({ today }: Readonly<CategoriesCardProps>) {
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
    >
      <SpendingByCategory breakdown={breakdown} month={month} />
      {hiddenCount > 0 && (
        <Link
          to="/reports"
          search={{ month: data.month }}
          className={`${sectionLinkClass} mt-auto self-start`}
        >
          {pluralize(hiddenCount, ["more category", "more categories"])} in{" "}
          {month}
          <LinkArrow />
        </Link>
      )}
    </DashboardCard>
  );
}

/**
 * Home as a dashboard grid: the figures, then spending beside the wallets,
 * then the records as a table. The cards in a row share one height.
 */
export function HomeDesktop({
  initialToday,
  savedId,
}: Readonly<HomeDesktopProps>) {
  const { today, walletCollection, daily, monthly, recent, arrive } =
    useHomeReads(initialToday);
  if (walletCollection.items.length === 0) {
    return (
      <Page layout="wide">
        <TitleBar title="Home" />
        <div className="max-w-2xl">
          <EmptyWallets />
        </div>
      </Page>
    );
  }
  const activeWallets = walletCollection.items.filter(
    (wallet) => !wallet.archivedAt,
  );
  const archivedCount = walletCollection.items.length - activeWallets.length;
  return (
    <Page layout="wide">
      <TitleBar title="Home" />
      <DashboardRow className={FIGURES_ROW}>
        <Arrival order={0} animate={arrive}>
          <WalletsTotal balance={walletCollection.balance} lead="spendable" />
        </Arrival>
        <Arrival order={1} animate={arrive}>
          <TodayCard report={daily} />
        </Arrival>
        <Arrival order={2} animate={arrive}>
          <MonthCard report={monthly} />
        </Arrival>
      </DashboardRow>
      <DashboardRow className={SPENDING_ROW}>
        <Arrival order={3} animate={arrive}>
          <CategoriesCard today={today} />
        </Arrival>
        <Arrival order={4} animate={arrive}>
          <DashboardCard headingId="home-wallets-heading" heading="Wallets">
            <WalletTable
              wallets={activeWallets}
              total={walletCollection.balance.total}
            />
            {archivedCount > 0 && (
              <p className="text-muted-foreground mt-auto text-sm">
                {pluralize(archivedCount, "archived wallet")} not shown
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
                <LinkArrow />
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
    </Page>
  );
}

/** The desktop Home in neutral blocks, in the ready grid's rows. */
export function HomeDesktopLoading() {
  return (
    <HomeLoading>
      <DashboardRow className={FIGURES_ROW}>
        <HeroSkeleton />
        <SummarySkeleton />
        <SummarySkeleton />
      </DashboardRow>
      <DashboardRow className={SPENDING_ROW}>
        <TableCardSkeleton />
        <TableCardSkeleton />
      </DashboardRow>
      <TableCardSkeleton />
    </HomeLoading>
  );
}
