import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { HistoryDataTable } from "@/features/transactions/components/history-data-table";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import { transactionColumns } from "@/features/transactions/components/transaction-columns";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import {
  changeHistoryTable,
  lastHistoryPage,
} from "@/features/transactions/history-pages";
import type {
  HistoryTableSearch,
  HistoryTableSettings,
} from "@/features/transactions/history-schema";
import { historyReadSearch } from "@/features/transactions/history-view";
import { WalletDesktopHeader } from "@/features/wallets/components/wallet-desktop-header";
import { WalletHistory } from "@/features/wallets/components/wallet-history";
import { WalletManageLink } from "@/features/wallets/components/wallet-manage-link";
import { TableCard } from "@/shared/components/dashboard-card";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletDesktopProps {
  wallet: components["schemas"]["Wallet"];
  page: components["schemas"]["TransactionCollection"];
  search: HistoryTableSearch;
}

/** From 1024px: a header with the balance as a figure, then one data table. */
export function WalletDesktop({
  wallet,
  page,
  search,
}: Readonly<WalletDesktopProps>) {
  const navigate = useNavigate();
  const columns = useMemo(() => transactionColumns(wallet.id), [wallet.id]);
  const { total } = page.page;
  const readSearch = historyReadSearch(search, { desktop: true });
  const lastPage = lastHistoryPage(readSearch, total);

  function show(change: HistoryTableSettings) {
    void navigate({
      to: "/wallets/$walletId",
      params: { walletId: wallet.id },
      search: changeHistoryTable(search, change),
    });
  }

  return (
    <Page layout="wide">
      <WalletDesktopHeader
        wallet={wallet}
        manage={<WalletManageLink walletId={wallet.id} />}
      />
      {search.deleted === 1 && <TransactionDeletedNotice />}
      {lastPage !== undefined ? (
        <PastLastPage
          page={search.page ?? 1}
          lastPage={lastPage}
          empty={total === 0}
        >
          <Link
            to="/wallets/$walletId"
            params={{ walletId: wallet.id }}
            search={changeHistoryTable(search, { page: lastPage })}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Go to page {lastPage}
          </Link>
        </PastLastPage>
      ) : (
        <WalletHistory empty={total === 0}>
          {/* Clips the sticky header's side fill to the card's corners. */}
          <TableCard className="overflow-clip">
            <TransactionRowActions>
              {(renderRowActions) => (
                <HistoryDataTable
                  columns={columns}
                  columnsStorageKey="bookkeeping.wallet-transactions-columns"
                  search={readSearch}
                  transactions={page.items}
                  total={total}
                  onChange={show}
                  renderRowActions={renderRowActions}
                />
              )}
            </TransactionRowActions>
          </TableCard>
        </WalletHistory>
      )}
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
