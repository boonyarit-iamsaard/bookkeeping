import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { TransactionTable } from "@/features/transactions/components/transaction-table";
import { WalletDesktopHeader } from "@/features/wallets/components/wallet-desktop-header";
import { WalletHistory } from "@/features/wallets/components/wallet-history";
import { WalletManageLink } from "@/features/wallets/components/wallet-manage-link";
import { TableCard } from "@/shared/components/dashboard-card";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";

interface WalletDesktopProps {
  wallet: components["schemas"]["Wallet"];
  page: components["schemas"]["TransactionCollection"];
  createdId: string | undefined;
  /** The page after this one; none on the last. */
  olderPage: number | undefined;
}

/** From 1024px: a header with the balance as a figure, then one table. */
export function WalletDesktop({
  wallet,
  page,
  createdId,
  olderPage,
}: Readonly<WalletDesktopProps>) {
  return (
    <Page layout="wide">
      <WalletDesktopHeader
        wallet={wallet}
        manage={<WalletManageLink walletId={wallet.id} />}
      />
      <WalletHistory
        walletId={wallet.id}
        empty={page.items.length === 0}
        olderPage={olderPage}
      >
        <TableCard>
          <TransactionTable
            transactions={page.items}
            savedId={createdId}
            groupByMonth
            pageWalletId={wallet.id}
          />
        </TableCard>
      </WalletHistory>
    </Page>
  );
}

/** The desktop wallet page in neutral blocks: the header, then a table. */
export function WalletDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="flex flex-col gap-6 sm:gap-8">
        <div className="flex items-center justify-between gap-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-14 w-56" />
        </div>
        <TableCardSkeleton rows={5} />
      </div>
    </Page>
  );
}
