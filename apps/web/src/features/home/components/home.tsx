import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { RecentTransactions } from "@/features/home/components/recent-transactions";
import { SummaryCard } from "@/features/home/components/summary-card";
import type { SummaryStripCard } from "@/features/home/components/summary-strip";
import { SummaryStrip } from "@/features/home/components/summary-strip";
import { WalletBalances } from "@/features/home/components/wallet-balances";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { walletCountLabel } from "@/features/wallets/wallet-labels";

/** From 1024px the figures hold the left column and the rows the right. */
export const HOME_COLUMNS_CLASS =
  "flex flex-col gap-6 sm:gap-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start";

// Home's first showing after the app opens lets its cards arrive one by one;
// every later visit shows them at once, until the app is opened again.
let homeHasArrived = false;

// A Home with no wallets has no cards yet, so it leaves the arrival for the
// first showing that does.
function useFirstShowing(hasCards: boolean) {
  const [first] = useState(() => !homeHasArrived);
  useEffect(() => {
    if (hasCards) {
      homeHasArrived = true;
    }
  }, [hasCards]);
  return first;
}

interface ArrivalProps {
  /** Its place in the sequence; each card follows the last by 40ms. */
  order: number;
  animate: boolean;
  children: React.ReactNode;
}

function Arrival({ order, animate, children }: Readonly<ArrivalProps>) {
  if (!animate) {
    return children;
  }
  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards motion-safe:ease-out-expo motion-safe:duration-300"
      style={{ animationDelay: `${order * 40}ms` }}
    >
      {children}
    </div>
  );
}

interface HomeProps {
  /** The phone account control the route supplies; the header has its own from 640px. */
  accountControl: React.ReactNode;
  initialToday: CalendarDate;
  savedId?: string;
}

/** How much there is, how today and the month are going, and what was just recorded. */
export function Home({
  accountControl,
  initialToday,
  savedId,
}: Readonly<HomeProps>) {
  const today = useBangkokToday(initialToday);
  const plan = createHomeQueryPlan(today);
  const { data: walletCollection } = useSuspenseQuery(plan.wallets);
  const { data: daily } = useSuspenseQuery(plan.daily);
  const { data: report } = useSuspenseQuery(plan.monthly);
  const { data: recent } = useSuspenseQuery(plan.recent);
  if (!walletCollection || !daily || !report || !recent) {
    throw new Error("The home queries returned no data");
  }
  const wallets = walletCollection.items;
  const arrive = useFirstShowing(wallets.length > 0);
  const summaryCards: SummaryStripCard[] = [
    {
      name: "Today",
      content: (
        <SummaryCard
          heading="Today"
          report={daily}
          renderLink={({ className, children }) => (
            <Link
              to="/transactions"
              search={{ from: daily.date, to: daily.date }}
              className={className}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
    {
      name: "This month",
      content: (
        <SummaryCard
          heading="This month"
          report={report}
          renderLink={({ className, children }) => (
            <Link
              to="/reports"
              search={{ month: report.month }}
              className={className}
            >
              {children}
            </Link>
          )}
        />
      ),
    },
  ];

  return (
    <Page layout="dashboard">
      <TitleBar
        title="Home"
        actions={<div className="sm:hidden">{accountControl}</div>}
      />
      {wallets.length === 0 ? (
        <EmptyWallets />
      ) : (
        <div className={HOME_COLUMNS_CLASS}>
          <div className="flex flex-col gap-6 sm:gap-8">
            <Arrival order={0} animate={arrive}>
              <WalletsTotal
                wallets={wallets}
                caption={`Across ${walletCountLabel(wallets.length)}`}
              />
            </Arrival>
            <Arrival order={1} animate={arrive}>
              <SummaryStrip cards={summaryCards} />
            </Arrival>
            {/* With one wallet the card would only repeat the total. */}
            {wallets.length > 1 && (
              <Arrival order={2} animate={arrive}>
                <WalletBalances wallets={wallets} />
              </Arrival>
            )}
          </div>
          <Arrival order={3} animate={arrive}>
            <RecentTransactions transactions={recent.items} savedId={savedId} />
          </Arrival>
        </div>
      )}
    </Page>
  );
}
