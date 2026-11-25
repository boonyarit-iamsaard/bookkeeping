import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { CashFlowCard } from "@/features/home/components/cash-flow-card";
import { Arrival } from "@/features/home/components/home-arrival";
import {
  HomeLoading,
  TileSkeleton,
} from "@/features/home/components/home-loading";
import { MonthFigureTile } from "@/features/home/components/month-figure-tile";
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

// Spendable beside this month's figures, then spending beside the wallets, 5 + 7 of twelve.
const FIVE_SEVEN_ROW = "grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
// Income and Net expenses side by side, Net beneath as their result, as on the phone's month card.
const MONTH_TILES = "grid grid-cols-2 gap-8 *:h-full";

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
 * Home as a dashboard grid: Spendable and this month's figures, the cash
 * flow, then spending beside the wallets, then the records as a table. The cards in a row share one height.
 */
export function HomeDesktop({
  initialToday,
  savedId,
}: Readonly<HomeDesktopProps>) {
  const { today, walletCollection, monthly, recent, arrive } =
    useHomeReads(initialToday);
  // The trend's six months end with this one, so the one before is last month.
  const previous = useSuspenseQueries({
    queries: createHomeQueryPlan(today).trend(),
  }).at(-2)?.data;
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
      <DashboardRow className={FIVE_SEVEN_ROW}>
        <Arrival order={0} animate={arrive}>
          <WalletsTotal balance={walletCollection.balance} lead="spendable" />
        </Arrival>
        <section aria-labelledby="home-month-heading" className={MONTH_TILES}>
          {/* The tiles read as this month's; the comparison names last month. */}
          <h2 id="home-month-heading" className="sr-only">
            This month
          </h2>
          {(["income", "netExpenses", "net"] as const).map((figure, index) => (
            <div
              key={figure}
              className={figure === "net" ? "col-span-2 *:h-full" : "*:h-full"}
            >
              <Arrival order={index + 1} animate={arrive}>
                <MonthFigureTile
                  figure={figure}
                  report={monthly}
                  previous={previous}
                />
              </Arrival>
            </div>
          ))}
        </section>
      </DashboardRow>
      <Arrival order={4} animate={arrive}>
        <CashFlowCard today={today} />
      </Arrival>
      <DashboardRow className={FIVE_SEVEN_ROW}>
        <Arrival order={5} animate={arrive}>
          <CategoriesCard today={today} />
        </Arrival>
        <Arrival order={6} animate={arrive}>
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
      <Arrival order={7} animate={arrive}>
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
      <DashboardRow className={FIVE_SEVEN_ROW}>
        <HeroSkeleton />
        <div className={MONTH_TILES}>
          <TileSkeleton />
          <TileSkeleton />
          <div className="col-span-2 *:h-full">
            <TileSkeleton />
          </div>
        </div>
      </DashboardRow>
      <TableCardSkeleton />
      <DashboardRow className={FIVE_SEVEN_ROW}>
        <TableCardSkeleton />
        <TableCardSkeleton />
      </DashboardRow>
      <TableCardSkeleton />
    </HomeLoading>
  );
}
