import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import {
  changeHistoryTable,
  lastHistoryPage,
} from "@/features/transactions/history-pages";
import type { HistoryTableSearch } from "@/features/transactions/history-schema";
import { WalletBalance } from "@/features/wallets/components/wallet-balance";
import { WalletHistory } from "@/features/wallets/components/wallet-history";
import { WalletManageLink } from "@/features/wallets/components/wallet-manage-link";
import { listCardClass } from "@/shared/components/list-section";
import {
  HeroSkeleton,
  RowSkeleton,
  Skeleton,
} from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletPhoneProps {
  wallet: components["schemas"]["Wallet"];
  page: components["schemas"]["TransactionCollection"];
  search: HistoryTableSearch;
  createdId: string | undefined;
  /** The page after this one; none on the last. */
  olderPage: number | undefined;
}

/** Below 1024px: the title bar, the balance hero, then month sections. */
export function WalletPhone({
  wallet,
  page,
  search,
  createdId,
  olderPage,
}: Readonly<WalletPhoneProps>) {
  const lastPage = lastHistoryPage(search, page.page.total);
  return (
    <Page layout="wide">
      <TitleBar
        title={wallet.name}
        back={<BackLink to="/wallets" aria-label="Back to Wallets" />}
        actions={<WalletManageLink walletId={wallet.id} />}
      />
      <WalletBalance wallet={wallet} />
      {lastPage === undefined ? (
        <WalletHistory
          walletId={wallet.id}
          empty={page.items.length === 0}
          olderPage={olderPage}
        >
          <MonthSections
            transactions={page.items}
            idPrefix="wallet"
            level={3}
            savedId={createdId}
            pageWalletId={wallet.id}
          />
        </WalletHistory>
      ) : (
        <PastLastPage page={search.page ?? 1} lastPage={lastPage}>
          <Link
            to="/wallets/$walletId"
            params={{ walletId: wallet.id }}
            search={changeHistoryTable(search, { page: lastPage })}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Go to page {lastPage}
          </Link>
        </PastLastPage>
      )}
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
