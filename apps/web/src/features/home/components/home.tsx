import type { CalendarDate } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { RecentTransactions } from "@/features/home/components/recent-transactions";
import { ThisMonth } from "@/features/home/components/this-month";
import { createHomeQueryPlan } from "@/features/home/home-queries";
import { useBangkokToday } from "@/features/transactions/hooks/use-bangkok-today";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { walletCountLabel } from "@/features/wallets/wallet-labels";

/** From 1024px the figures hold the left column and the rows the right. */
export const HOME_COLUMNS_CLASS =
  "flex flex-col gap-6 sm:gap-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start";

interface HomeProps {
  /** The phone account control the route supplies; the header has its own from 640px. */
  accountControl: React.ReactNode;
  initialToday: CalendarDate;
  savedId?: string;
}

/** How much there is, how the month is going, and what was just recorded. */
export function Home({
  accountControl,
  initialToday,
  savedId,
}: Readonly<HomeProps>) {
  const today = useBangkokToday(initialToday);
  const plan = createHomeQueryPlan(today);
  const { data: walletCollection } = useSuspenseQuery(plan.wallets);
  const { data: report } = useSuspenseQuery(plan.monthly);
  const { data: recent } = useSuspenseQuery(plan.recent);
  if (!walletCollection || !report || !recent) {
    throw new Error("The home queries returned no data");
  }
  const wallets = walletCollection.items;

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
          <div className="flex flex-col gap-6 sm:gap-8 lg:sticky lg:top-24">
            <WalletsTotal
              wallets={wallets}
              caption={`Across ${walletCountLabel(wallets.length)}`}
            />
            <ThisMonth report={report} />
          </div>
          <RecentTransactions transactions={recent.items} savedId={savedId} />
        </div>
      )}
    </Page>
  );
}
