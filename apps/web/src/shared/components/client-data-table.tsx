import type { RowData, SortingState } from "@tanstack/react-table";
import { functionalUpdate, useTable } from "@tanstack/react-table";
import type * as React from "react";
import { useState } from "react";
import type { DataTableColumn } from "@/shared/components/data-table";
import {
  DataTableBody,
  dataTableFeatures,
  HeaderCell,
} from "@/shared/components/data-table";
import {
  Table,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

interface ClientDataTableProps<TData extends RowData> {
  /** Names the table for assistive technology. */
  label: string;
  /** Sortable columns opt in with `enableSorting` and a `sortFn`. */
  columns: readonly DataTableColumn<TData>[];
  rows: readonly TData[];
  rowId: (row: TData) => string;
  /** Rows nested under a row; each level sorts among its own siblings. */
  subRows?: (row: TData) => readonly TData[];
  /** Attributes for one row's `tr`, such as a data hook. */
  rowProps?: (row: TData) => React.ComponentProps<"tr">;
  /** A last cell per row, such as its action menu; it sits above the row's stretched link. */
  rowActions?: (row: TData) => React.ReactNode;
  /** Rows beneath the body, such as a total. */
  footer?: React.ReactNode;
}

/**
 * A desktop table for a small list: every row on one page, sorted in the
 * browser by whichever header was chosen last, in the list's own order until
 * then. Shares its headers and rows with `DataTable`.
 */
export function ClientDataTable<TData extends RowData>({
  label,
  columns,
  rows,
  rowId,
  subRows,
  rowProps,
  rowActions,
  footer,
}: Readonly<ClientDataTableProps<TData>>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: dataTableFeatures,
    columns: [...columns],
    data: [...rows],
    getRowId: rowId,
    getSubRows: subRows ? (row) => [...subRows(row)] : undefined,
    state: { sorting },
    onSortingChange: (updater) =>
      setSorting(functionalUpdate(updater, sorting)),
    enableMultiSort: false,
    enableSortingRemoval: false,
    defaultColumn: { enableSorting: false, enableHiding: false },
  });
  return (
    <Table aria-label={label}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <HeaderCell key={header.id} header={header} />
            ))}
            {rowActions && (
              <TableHead className="w-px">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        ))}
      </TableHeader>
      <DataTableBody
        table={table}
        rowProps={rowProps}
        rowActions={rowActions}
      />
      {footer && <TableFooter>{footer}</TableFooter>}
    </Table>
  );
}
