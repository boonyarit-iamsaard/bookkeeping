import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { CashFlowCard } from "@/features/home/components/cash-flow-card";
import { CategoryComparisonCard } from "@/features/home/components/category-comparison-card";
import { Arrival } from "@/features/home/components/home-arrival";
import { MonthFigureTile } from "@/features/home/components/month-figure-tile";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { useHomeReads } from "@/features/home/hooks/use-home-reads";
import {
  RECENT_TRANSACTION_COLUMNS,
  transactionRowProps,
} from "@/features/transactions/components/transaction-columns";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletTable } from "@/features/wallets/components/wallet-table";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { DashboardCard } from "@/shared/components/dashboard-card";
import { DashboardRow } from "@/shared/components/dashboard-row";
import { CompactDataTable } from "@/shared/components/data-table";
import { sectionLinkClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  Skeleton,
  TableCardSkeleton,
} from "@/shared/components/skeleton";
import { pluralize } from "@/shared/helpers/pluralize";

interface HomeDesktopProps {
  initialToday: CalendarDate;
  savedId?: string;
}

// Spendable beside this month's figures, then the wallets beside the recent records, 5 + 7 of twelve.
const FIVE_SEVEN_ROW = "grid-cols-[minmax(0,5fr)_minmax(0,7fr)]";
// Income and Net expenses side by side, Net beneath as their result, as on the phone's month card.
const MONTH_TILES = "grid grid-cols-2 gap-8 *:h-full";

function LinkArrow() {
  return <ArrowRight aria-hidden="true" strokeWidth={2} className="size-3.5" />;
}

/**
 * Home as a dashboard grid: Spendable and this month's figures, the cash
 * flow, then this month's spending beside last month's, then the wallets
 * beside the recent records. The cards in a row share one height.
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
      <Arrival order={5} animate={arrive}>
        <CategoryComparisonCard today={today} />
      </Arrival>
      <DashboardRow className={FIVE_SEVEN_ROW}>
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
        <Arrival order={7} animate={arrive}>
          <DashboardCard
            headingId="recent-heading"
            heading="Recent transactions"
            action={
              recent.length > 0 && (
                <Link to="/transactions" className={sectionLinkClass}>
                  View all <span className="sr-only">transactions</span>
                  <LinkArrow />
                </Link>
              )
            }
          >
            {recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No transactions yet
              </p>
            ) : (
              <CompactDataTable
                label="Recent transactions"
                columns={RECENT_TRANSACTION_COLUMNS}
                rows={recent}
                rowId={(transaction) => transaction.id}
                rowProps={transactionRowProps(savedId)}
              />
            )}
          </DashboardCard>
        </Arrival>
      </DashboardRow>
    </Page>
  );
}

/** A desktop month figure tile in neutral blocks. */
function TileSkeleton() {
  return (
    <div className="bg-card shadow-card flex flex-col rounded-2xl p-6">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-auto h-8 w-36" />
      <Skeleton className="mt-2 h-4 w-32" />
    </div>
  );
}

/** The desktop Home in neutral blocks, in the ready grid's rows. */
export function HomeDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Home" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
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
        <TableCardSkeleton />
        <DashboardRow className={FIVE_SEVEN_ROW}>
          <TableCardSkeleton />
          <TableCardSkeleton />
        </DashboardRow>
      </div>
    </Page>
  );
}
