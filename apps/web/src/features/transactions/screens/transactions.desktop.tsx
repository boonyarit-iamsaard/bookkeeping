import { Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HistoryDataTable } from "@/features/transactions/components/history-data-table";
import { HistoryFilterBar } from "@/features/transactions/components/history-filter-bar";
import { HistoryTypeTabs } from "@/features/transactions/components/history-type-tabs";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import { TRANSACTION_COLUMNS } from "@/features/transactions/components/transaction-columns";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import type { HistoryTableSettings } from "@/features/transactions/history-pages";
import { changeHistoryTable } from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { DEFAULT_HISTORY_PAGE_SIZE } from "@/features/transactions/history-view";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { TableCard } from "@/shared/components/dashboard-card";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";

interface TransactionsDesktopProps {
  search: HistorySearch;
}

/** The desktop list's loading shape: the title, the filter bar, a table. */
export function TransactionsDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Transactions" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <Skeleton className="h-16" />
        <TableCardSkeleton rows={5} />
      </div>
    </Page>
  );
}

/** From 1024px: a filter bar over one data table that sorts and pages on the server. */
export function TransactionsDesktop({
  search,
}: Readonly<TransactionsDesktopProps>) {
  const navigate = useNavigate();
  const { view, pending, transactions, total, filterErrors, ...collections } =
    useHistoryReads(search);
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? DEFAULT_HISTORY_PAGE_SIZE;
  const lastPage = Math.ceil(total / pageSize);

  function show(change: HistoryTableSettings) {
    void navigate({
      to: "/transactions",
      search: changeHistoryTable(search, change),
    });
  }

  if (pending) {
    return <TransactionsDesktopLoading />;
  }

  return (
    <Page layout="wide">
      <TitleBar title="Transactions" />
      {/* An empty ledger has nothing to narrow. */}
      {(view.hasFilters || total > 0) && (
        <>
          <HistoryFilterBar {...collections} values={view.values} />
          {/* Outside the table, so an empty tab still leads back to the others. */}
          <HistoryTypeTabs search={search} view={view} />
        </>
      )}
      {search.deleted === 1 && <TransactionDeletedNotice />}
      {transactions.length === 0 && page > lastPage && lastPage > 0 ? (
        <PastLastPage page={page} lastPage={lastPage}>
          <Link
            to="/transactions"
            search={changeHistoryTable(search, { page: lastPage })}
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Go to page {lastPage}
          </Link>
        </PastLastPage>
      ) : (
        <TransactionHistory
          transactions={transactions}
          filterErrors={filterErrors}
          filtered={view.hasFilters}
        >
          {/* Clips the sticky header's side fill to the card's corners. */}
          <TableCard className="overflow-clip">
            <HistoryDataTable
              columns={TRANSACTION_COLUMNS}
              columnsStorageKey="bookkeeping.transactions-columns"
              search={search}
              transactions={transactions}
              total={total}
              onChange={show}
            />
          </TableCard>
        </TransactionHistory>
      )}
    </Page>
  );
}
