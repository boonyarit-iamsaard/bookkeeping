import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { DesktopHome } from "@/features/home/components/desktop-home";
import {
  Arrival,
  useFirstShowing,
} from "@/features/home/components/home-arrival";
import { RecentTransactions } from "@/features/home/components/recent-transactions";
import { SummaryCard } from "@/features/home/components/summary-card";
import { SummaryStrip } from "@/features/home/components/summary-strip";
import { WalletBalances } from "@/features/home/components/wallet-balances";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";
import { useToday } from "@/shared/hooks/use-today";

interface HomeProps {
  /** The phone account control the route supplies; the top bar has its own from 1024px. */
  accountControl: React.ReactNode;
  initialToday: CalendarDate;
  savedId?: string;
}

/**
 * How much there is, how today and the month are going, and what was just
 * recorded: one column on phone, a dashboard grid from 1024px.
 */
export function Home({
  accountControl,
  initialToday,
  savedId,
}: Readonly<HomeProps>) {
  const today = useToday(initialToday);
  const desktop = useIsDesktop();
  const plan = createHomeQueryPlan(today);
  const { data: walletCollection } = useSuspenseQuery(plan.wallets);
  const { data: daily } = useSuspenseQuery(plan.daily);
  const { data: report } = useSuspenseQuery(plan.monthly);
  const { data: recent } = useSuspenseQuery(plan.recent);
  const wallets = walletCollection.items;
  const arrive = useFirstShowing(wallets.length > 0);
  const dayCard = (
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
  );
  const monthCard = (
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
  );

  let content: React.ReactNode;
  if (wallets.length === 0) {
    content = desktop ? (
      <div className="max-w-2xl">
        <EmptyWallets />
      </div>
    ) : (
      <EmptyWallets />
    );
  } else if (desktop) {
    content = (
      <DesktopHome
        today={today}
        walletCollection={walletCollection}
        summaryCards={[dayCard, monthCard]}
        recent={recent.items}
        savedId={savedId}
        arrive={arrive}
      />
    );
  } else {
    content = (
      <>
        <Arrival order={0} animate={arrive}>
          <WalletsTotal balance={walletCollection.balance} lead="spendable" />
        </Arrival>
        <Arrival order={1} animate={arrive}>
          <SummaryStrip
            cards={[
              { name: "Today", content: dayCard },
              { name: "This month", content: monthCard },
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
          <RecentTransactions transactions={recent.items} savedId={savedId} />
        </Arrival>
      </>
    );
  }

  return (
    <Page layout="wide">
      <TitleBar
        title="Home"
        actions={<div className="lg:hidden">{accountControl}</div>}
      />
      {content}
    </Page>
  );
}
