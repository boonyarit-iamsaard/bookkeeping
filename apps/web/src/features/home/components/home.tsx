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

interface HomeProps {
  initialToday: CalendarDate;
  createdId?: string;
}

/** How much there is, how the month is going, and what was just recorded. */
export function Home({ initialToday, createdId }: Readonly<HomeProps>) {
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
    <Page layout="wide">
      <TitleBar title="Home" />
      {wallets.length === 0 ? (
        <EmptyWallets />
      ) : (
        <>
          <WalletsTotal
            wallets={wallets}
            caption={`Across ${walletCountLabel(wallets.length)}`}
          />
          <ThisMonth report={report} />
          <RecentTransactions transactions={recent.items} savedId={createdId} />
        </>
      )}
    </Page>
  );
}
