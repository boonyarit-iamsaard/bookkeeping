import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { WalletBalance } from "@/features/wallets/components/wallet-balance";
import { WalletHistory } from "@/features/wallets/components/wallet-history";
import { WalletManageLink } from "@/features/wallets/components/wallet-manage-link";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";

interface WalletPhoneProps {
  wallet: components["schemas"]["Wallet"];
  page: components["schemas"]["TransactionCollection"];
  createdId: string | undefined;
}

/** Below 1024px: the title bar, the balance hero, then month sections. */
export function WalletPhone({
  wallet,
  page,
  createdId,
}: Readonly<WalletPhoneProps>) {
  return (
    <Page layout="wide">
      <TitleBar
        title={wallet.name}
        back={<BackLink to="/wallets" aria-label="Back to Wallets" />}
        actions={<WalletManageLink walletId={wallet.id} />}
      />
      <WalletBalance wallet={wallet} />
      <WalletHistory
        walletId={wallet.id}
        empty={page.items.length === 0}
        nextCursor={page.page.nextCursor}
      >
        <MonthSections
          transactions={page.items}
          idPrefix="wallet"
          level={3}
          savedId={createdId}
          pageWalletId={wallet.id}
        />
      </WalletHistory>
    </Page>
  );
}

/**
 * The phone wallet page in neutral blocks: its unknown name, the balance,
 * then the records. It never shows a figure that could pass for money.
 */
export function WalletPhoneLoading() {
  return (
    <Page layout="wide" loading>
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        <Skeleton className="mt-4 h-8 w-48 sm:mt-0" />
        <HeroSkeleton captionClassName="w-24" />
        <div className="flex flex-col gap-3">
          <Skeleton className="ml-1 h-6 w-40" />
          <div className={listCardClass}>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </div>
      </div>
    </Page>
  );
}
