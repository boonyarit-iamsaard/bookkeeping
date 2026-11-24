import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  HistoryFilterChips,
  HistoryFilters,
} from "@/features/transactions/components/history-filters";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { OlderTransactionsLink } from "@/features/transactions/components/older-transactions-link";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";

interface TransactionsPhoneProps {
  search: HistorySearch;
}

/** Below 1024px: filters in a sheet, chips, and the history in month sections. */
export function TransactionsPhone({
  search,
}: Readonly<TransactionsPhoneProps>) {
  const { view, transactions, nextCursor, filterErrors, ...collections } =
    useHistoryReads(search);
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
      <OlderTransactionsLink values={view.values} cursor={nextCursor} />
    </Page>
  );
}
