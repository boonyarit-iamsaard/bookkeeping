import { Link } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  HistoryFilterChips,
  HistoryFilters,
} from "@/features/transactions/components/history-filters";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { OlderTransactionsLink } from "@/features/transactions/components/older-transactions-link";
import { PastLastPage } from "@/features/transactions/components/past-last-page";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import {
  changeHistoryTable,
  lastHistoryPage,
  olderHistoryPage,
} from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { historyReadSearch } from "@/features/transactions/history-view";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { buttonVariants } from "@/shared/components/ui/button";

interface TransactionsPhoneProps {
  search: HistorySearch;
}

/** Below 1024px: filters in a sheet, chips, and the history in month sections. */
export function TransactionsPhone({
  search,
}: Readonly<TransactionsPhoneProps>) {
  const readSearch = historyReadSearch(search, { desktop: false });
  const { view, pending, transactions, total, filterErrors, ...collections } =
    useHistoryReads(readSearch);
  const lastPage =
    view.state === "valid" ? lastHistoryPage(readSearch, total) : undefined;
  if (pending) {
    return <HistoryLoading />;
  }
  return (
    <Page layout="wide">
      <TitleBar
        title="Transactions"
        actions={
          <HistoryFilters
            {...collections}
            values={view.values}
            errors={filterErrors}
          />
        }
      />
      <HistoryFilterChips {...collections} view={view} />
      {search.deleted === 1 && <TransactionDeletedNotice />}
      {lastPage === undefined ? (
        <TransactionHistory
          transactions={transactions}
          filterErrors={filterErrors}
          filtered={view.hasFilters}
        >
          <MonthSections
            transactions={transactions}
            idPrefix="history"
            savedId={search.created}
          />
        </TransactionHistory>
      ) : (
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
      )}
      <OlderTransactionsLink
        search={search}
        page={olderHistoryPage(readSearch, total)}
      />
    </Page>
  );
}
