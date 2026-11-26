import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { captureSearchForLocation } from "@/features/transactions/capture-origin";
import { HistoryDataTable } from "@/features/transactions/components/history-data-table";
import { HistoryFilterBar } from "@/features/transactions/components/history-filter-bar";
import { HistoryTypeTabs } from "@/features/transactions/components/history-type-tabs";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import { useOpenRecordDialog } from "@/features/transactions/components/record-transaction-dialog";
import { TRANSACTION_COLUMNS } from "@/features/transactions/components/transaction-columns";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import {
  changeHistoryTable,
  lastHistoryPage,
} from "@/features/transactions/history-pages";
import type {
  HistorySearch,
  HistoryTableSettings,
} from "@/features/transactions/history-schema";
import { historyReadSearch } from "@/features/transactions/history-view";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { TableCard } from "@/shared/components/dashboard-card";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";

interface TransactionsDesktopProps {
  search: HistorySearch;
}

/** The screen's one Iris action, moved here from the top bar. */
function NewTransactionLink() {
  const location = useLocation();
  const openRecord = useOpenRecordDialog();
  return (
    <Link
      to="/transactions/new"
      search={captureSearchForLocation(location)}
      onClick={openInPlace(openRecord)}
      className={buttonVariants({ size: "lg" })}
    >
      New transaction
    </Link>
  );
}

/** The desktop list's loading shape: the title, the filter bar, a table. */
export function TransactionsDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Transactions" actions={<NewTransactionLink />} />
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
  const readSearch = historyReadSearch(search, { desktop: true });
  const { view, pending, transactions, total, filterErrors, ...collections } =
    useHistoryReads(readSearch);
  const lastPage =
    view.state === "valid" ? lastHistoryPage(readSearch, total) : undefined;

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
      <TitleBar title="Transactions" actions={<NewTransactionLink />} />
      {/* An empty ledger has nothing to narrow. */}
      {(view.hasFilters || total > 0) && (
        <>
          <HistoryFilterBar {...collections} values={view.values} />
          {/* Outside the table, so an empty tab still leads back to the others. */}
          <HistoryTypeTabs search={search} view={view} />
        </>
      )}
      {search.deleted === 1 && <TransactionDeletedNotice />}
      {lastPage !== undefined ? (
        <PastLastPage
          page={search.page ?? 1}
          lastPage={lastPage}
          empty={total === 0}
        >
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
            <TransactionRowActions>
              {(renderRowActions) => (
                <HistoryDataTable
                  columns={TRANSACTION_COLUMNS}
                  columnsStorageKey="bookkeeping.transactions-columns"
                  search={readSearch}
                  transactions={transactions}
                  total={total}
                  onChange={show}
                  renderRowActions={renderRowActions}
                />
              )}
            </TransactionRowActions>
          </TableCard>
        </TransactionHistory>
      )}
    </Page>
  );
}
