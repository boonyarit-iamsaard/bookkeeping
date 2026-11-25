import {
  TRANSACTION_LIST_SORTS,
  TRANSACTION_PAGE_SIZES,
} from "@bookkeeping/domain/transactions";
import { Link, useNavigate } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { HistoryFilterBar } from "@/features/transactions/components/history-filter-bar";
import { HistoryTypeTabs } from "@/features/transactions/components/history-type-tabs";
import {
  TRANSACTION_COLUMNS,
  transactionRowProps,
} from "@/features/transactions/components/transaction-columns";
import { TransactionDeletedNotice } from "@/features/transactions/components/transaction-deleted-notice";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import type { HistoryTableSettings } from "@/features/transactions/history-pages";
import { changeHistoryTable } from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { DEFAULT_HISTORY_PAGE_SIZE } from "@/features/transactions/history-view";
import { useHistoryReads } from "@/features/transactions/hooks/use-history-reads";
import { TableCard } from "@/shared/components/dashboard-card";
import { DataTable } from "@/shared/components/data-table";
import { Skeleton, TableCardSkeleton } from "@/shared/components/skeleton";
import { buttonVariants } from "@/shared/components/ui/button";

interface TransactionsDesktopProps {
  search: HistorySearch;
}

function countLabel(total: number) {
  return `${total.toLocaleString("en-US")} ${total === 1 ? "transaction" : "transactions"}`;
}

interface PastLastPageProps {
  search: HistorySearch;
  lastPage: number;
}

/** An old link to a page the list no longer reaches. */
function PastLastPage({ search, lastPage }: Readonly<PastLastPageProps>) {
  return (
    <section
      className="bg-card shadow-card flex flex-col items-start gap-3 rounded-2xl p-7"
      aria-labelledby="past-last-heading"
    >
      <h2 id="past-last-heading" className="text-lg font-bold tracking-tight">
        Page {search.page} is past the end
      </h2>
      <p className="text-muted-foreground max-w-prose text-sm leading-normal">
        This list has {lastPage} {lastPage === 1 ? "page" : "pages"}.
      </p>
      <Link
        to="/transactions"
        search={changeHistoryTable(search, { page: lastPage })}
        className={buttonVariants({ variant: "secondary", size: "lg" })}
      >
        Go to page {lastPage}
      </Link>
    </section>
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
        <PastLastPage search={search} lastPage={lastPage} />
      ) : (
        <TransactionHistory
          transactions={transactions}
          filterErrors={filterErrors}
          filtered={view.hasFilters}
        >
          {/* Clips the sticky header's side fill to the card's corners. */}
          <TableCard className="overflow-clip">
            <TransactionRowActions>
              {(rowActions) => (
                <DataTable
                  label="Transactions"
                  columns={TRANSACTION_COLUMNS}
                  rows={transactions}
                  rowId={(transaction) => transaction.id}
                  rowProps={transactionRowProps(search.created)}
                  sorting={[
                    {
                      id: search.sort ?? "date",
                      desc: (search.order ?? "desc") === "desc",
                    },
                  ]}
                  onSortingChange={([next]) => {
                    const sort = TRANSACTION_LIST_SORTS.find(
                      (name) => name === next?.id,
                    );
                    if (sort) {
                      show({ sort, order: next?.desc ? "desc" : "asc" });
                    }
                  }}
                  pagination={{ pageIndex: page - 1, pageSize }}
                  onPaginationChange={(next) => {
                    const size = TRANSACTION_PAGE_SIZES.find(
                      (option) => option === next.pageSize,
                    );
                    show(
                      size === pageSize
                        ? { page: next.pageIndex + 1 }
                        : { pageSize: size },
                    );
                  }}
                  pageSizes={TRANSACTION_PAGE_SIZES}
                  rowCount={total}
                  rowCountLabel={countLabel(total)}
                  columnsStorageKey="bookkeeping.transactions-columns"
                  rowActions={rowActions}
                />
              )}
            </TransactionRowActions>
          </TableCard>
        </TransactionHistory>
      )}
    </Page>
  );
}
