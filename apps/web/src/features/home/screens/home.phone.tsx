import type { CalendarDate } from "@bookkeeping/domain/dates";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { Arrival } from "@/features/home/components/home-arrival";
import {
  HomeLoading,
  SummarySkeleton,
} from "@/features/home/components/home-loading";
import { MonthCard, TodayCard } from "@/features/home/components/period-cards";
import { RecentTransactions } from "@/features/home/components/recent-transactions";
import { SummaryStrip } from "@/features/home/components/summary-strip";
import { WalletBalances } from "@/features/home/components/wallet-balances";
import { useHomeReads } from "@/features/home/hooks/use-home-reads";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";

interface HomePhoneProps {
  /** The account control; the desktop top bar has its own. */
  accountControl: React.ReactNode;
  initialToday: CalendarDate;
  savedId?: string;
}

/**
 * How much there is, how today and the month are going, and what was just
 * recorded, in one column.
 */
export function HomePhone({
  accountControl,
  initialToday,
  savedId,
}: Readonly<HomePhoneProps>) {
  const { walletCollection, daily, monthly, recent, arrive } =
    useHomeReads(initialToday);
  const wallets = walletCollection.items;

  return (
    <Page layout="wide">
      <TitleBar title="Home" actions={accountControl} />
      {wallets.length === 0 ? (
        <EmptyWallets />
      ) : (
        <>
          <Arrival order={0} animate={arrive}>
            <WalletsTotal balance={walletCollection.balance} lead="spendable" />
          </Arrival>
          <Arrival order={1} animate={arrive}>
            <SummaryStrip
              cards={[
                { name: "Today", content: <TodayCard report={daily} /> },
                { name: "This month", content: <MonthCard report={monthly} /> },
              ]}
            />
          </Arrival>
          {/* With one wallet the card would only repeat the total. */}
          {wallets.length > 1 && (
            <Arrival order={2} animate={arrive}>
              <WalletBalances wallets={wallets} />
            </Arrival>
          )}
          <Arrival order={3} animate={arrive}>
            <RecentTransactions transactions={recent} savedId={savedId} />
          </Arrival>
        </>
      )}
    </Page>
  );
}

/** The phone Home in neutral blocks. */
export function HomePhoneLoading() {
  return (
    <HomeLoading>
      <HeroSkeleton />
      <SummarySkeleton />
      <div className="flex flex-col gap-3">
        <Skeleton className="ml-1 h-6 w-48" />
        <div className={listCardClass}>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    </HomeLoading>
  );
}
