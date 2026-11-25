import {
  TRANSACTION_LIST_SORTS,
  TRANSACTION_PAGE_SIZES,
} from "@bookkeeping/domain/transactions";
import type { components } from "@/core/api/openapi.gen";
import { transactionRowProps } from "@/features/transactions/components/transaction-columns";
import type {
  HistoryTableSearch,
  HistoryTableSettings,
} from "@/features/transactions/history-schema";
import { historyPageSize } from "@/features/transactions/history-view";
import type { DataTableColumn } from "@/shared/components/data-table";
import { DataTable } from "@/shared/components/data-table";

type ApiTransaction = components["schemas"]["Transaction"];

interface HistoryDataTableProps {
  columns: readonly DataTableColumn<ApiTransaction>[];
  columnsStorageKey: string;
  search: HistoryTableSearch;
  transactions: readonly ApiTransaction[];
  /** The filtered list's size across all pages. */
  total: number;
  /** The address's change for one table control. */
  onChange: (change: HistoryTableSettings) => void;
  /** A last cell per row, such as its action menu. */
  rowActions?: (transaction: Readonly<ApiTransaction>) => React.ReactNode;
}

function countLabel(total: number) {
  return `${total.toLocaleString("en-US")} ${total === 1 ? "transaction" : "transactions"}`;
}

/** The transaction list's data table: server sort and pages, read from and written to the address. */
export function HistoryDataTable({
  columns,
  columnsStorageKey,
  search,
  transactions,
  total,
  onChange,
  rowActions,
}: Readonly<HistoryDataTableProps>) {
  const page = search.page ?? 1;
  const pageSize = historyPageSize(search);
  return (
    <DataTable
      label="Transactions"
      columns={columns}
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
        const sort = TRANSACTION_LIST_SORTS.find((name) => name === next?.id);
        if (sort) {
          onChange({ sort, order: next?.desc ? "desc" : "asc" });
        }
      }}
      pagination={{ pageIndex: page - 1, pageSize }}
      onPaginationChange={(next) => {
        const size = TRANSACTION_PAGE_SIZES.find(
          (option) => option === next.pageSize,
        );
        onChange(
          size === pageSize ? { page: next.pageIndex + 1 } : { pageSize: size },
        );
      }}
      pageSizes={TRANSACTION_PAGE_SIZES}
      rowCount={total}
      rowCountLabel={countLabel(total)}
      columnsStorageKey={columnsStorageKey}
      rowActions={rowActions}
    />
  );
}
