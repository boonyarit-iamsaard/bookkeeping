import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HistoryFilterBar } from "@/features/transactions/components/history-filter-bar";
import { OlderTransactionsLink } from "@/features/transactions/components/older-transactions-link";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import { TransactionTable } from "@/features/transactions/components/transaction-table";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { TableCard } from "@/shared/components/dashboard-card";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";

interface TransactionsDesktopProps {
  search: HistorySearch;
}

/** From 1024px: a filter bar over one table with month rows. */
export function TransactionsDesktop({
  search,
}: Readonly<TransactionsDesktopProps>) {
  const { view, transactions, nextCursor, filterErrors, ...collections } =
    useHistoryReads(search);
  return (
    <Page layout="wide">
      <TitleBar title="Transactions" />
      {/* An empty ledger has nothing to narrow. */}
      {(view.hasFilters || transactions.length > 0) && (
        <HistoryFilterBar {...collections} values={view.values} />
      )}
      {search.deleted === 1 && <TransactionDeletedNotice />}
      <TransactionHistory
        transactions={transactions}
        filterErrors={filterErrors}
        filtered={view.hasFilters}
      >
        {/* The months are header rows of one table, not a list each. */}
        <TableCard>
          <TransactionTable
            transactions={transactions}
            savedId={search.created}
            groupByMonth
          />
        </TableCard>
      </TransactionHistory>
      <OlderTransactionsLink values={view.values} cursor={nextCursor} />
    </Page>
  );
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
