import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { captureSearchForLocation } from "@/features/transactions/capture-origin";
import { HistoryDataTable } from "@/features/transactions/components/history-data-table";
import { HistoryFilterPopover } from "@/features/transactions/components/history-filter-popover";
import { HistoryToolbarChips } from "@/features/transactions/components/history-toolbar-chips";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import { useOpenRecordDialog } from "@/features/transactions/components/record-transaction-dialog";
import { TRANSACTION_COLUMNS } from "@/features/transactions/components/transaction-columns";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { FilterErrorNotice } from "@/features/transactions/components/transaction-history";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import {
  changeHistoryTable,
  historyTableSettings,
  lastHistoryPage,
} from "@/features/transactions/history-pages";
import type {
  HistorySearch,
  HistoryTableSettings,
} from "@/features/transactions/history-schema";
import { historyReadSearch } from "@/features/transactions/history-view";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { TableCard } from "@/shared/components/dashboard-card";
import { TableCardSkeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";
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

/** No row matches the filters: a message in the table card and a way back to every row. */
function NoMatchingTransactions({
  search,
}: Readonly<{ search: HistorySearch }>) {
  return (
    <section
      aria-labelledby="no-matches-heading"
      className="flex flex-col items-start gap-1.5"
    >
      <h2 id="no-matches-heading" className="text-lg font-bold tracking-tight">
        No matching transactions
      </h2>
      <p className="text-muted-foreground max-w-prose text-sm leading-normal">
        Try a wider date range, or clear the filters to see all your history.
      </p>
      <Link
        to="/transactions"
        // The table settings alone: every filter, the page and notices go.
        search={historyTableSettings(search)}
        className={cn(buttonVariants({ variant: "secondary" }), "mt-2.5")}
      >
        Clear filters
      </Link>
    </section>
  );
}

/** The desktop list's loading shape: the title and a table. */
export function TransactionsDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Transactions" actions={<NewTransactionLink />} />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <TableCardSkeleton rows={5} />
      </div>
    </Page>
  );
}

/** From 1024px: one data table that filters, sorts and pages on the server. */
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

  // With no rows, the card keeps its toolbar and says why under it.
  const empty =
    filterErrors.length > 0 ? (
      <FilterErrorNotice errors={filterErrors} />
    ) : (
      <NoMatchingTransactions search={search} />
    );
  const historyTable = (
    // Clips the sticky header's side fill to the card's corners.
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
            toolbarStart={<HistoryToolbarChips {...collections} view={view} />}
            toolbarEnd={
              <HistoryFilterPopover {...collections} values={view.values} />
            }
            empty={empty}
            renderRowActions={renderRowActions}
          />
        )}
      </TransactionRowActions>
    </TableCard>
  );

  if (pending) {
    return <TransactionsDesktopLoading />;
  }

  return (
    <Page layout="wide">
      <TitleBar title="Transactions" actions={<NewTransactionLink />} />
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
      ) : view.hasFilters || transactions.length > 0 ? (
        historyTable
      ) : (
        <TransactionList transactions={transactions} />
      )}
    </Page>
  );
}
