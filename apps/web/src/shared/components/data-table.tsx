import type {
  CellData,
  ColumnDef,
  Header,
  PaginationState,
  Table as ReactTable,
  Row,
  RowData,
  SortingState,
  TableFeatures,
} from "@tanstack/react-table";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createSortedRowModel,
  FlexRender,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import type * as React from "react";
import { useId } from "react";
import {
  ColumnsMenu,
  useStoredColumnVisibility,
} from "@/shared/components/data-table-columns";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";
import { pageRangeLabel } from "@/shared/helpers/page-range";

declare module "@tanstack/react-table" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** Figures sit at the column's end, header included. */
    align?: "end";
    /** Takes the table's spare width and truncates first when there is none. */
    grow?: true;
    /** Drops out when the table sits in a narrow card container. */
    secondary?: true;
    /** An optional column the owner must choose to show. */
    hiddenByDefault?: true;
    /** The header names the column for screen readers only, as over icons. */
    srOnlyHeader?: true;
  }
}

/** A column a narrow dashboard card drops, so no figure beside it clips. */
export const SECONDARY_COLUMN = "@max-sm:hidden";

// The sorted row model serves `ClientDataTable`; `manualSorting` leaves it idle here.
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
});

export type DataTableFeatures = typeof features;
export { features as dataTableFeatures };

export type DataTableColumn<TData extends RowData> = ColumnDef<
  DataTableFeatures,
  TData,
  // biome-ignore lint/suspicious/noExplicitAny: a column list mixes value types, as react-table's own examples do.
  any
>;

/** The column helper for a data table's rows. */
export function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** A row's `tr` attributes, including data hooks. */
export type RowProps = React.ComponentProps<"tr"> &
  Partial<Record<`data-${string}`, boolean>>;

interface DataTableProps<TData extends RowData> {
  /** Names the table for assistive technology. */
  label: string;
  columns: readonly DataTableColumn<TData>[];
  rows: readonly TData[];
  rowId: (row: TData) => string;
  /** Attributes for one row's `tr`, such as a data hook or a highlight; every row highlights on hover. */
  rowProps?: (row: TData) => RowProps;
  /** The server's order: one column, ascending or descending. */
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  /** The server's page, from index 0. */
  pagination: PaginationState;
  onPaginationChange: (pagination: PaginationState) => void;
  pageSizes: readonly number[];
  /** Every row the server holds across all pages. */
  rowCount: number;
  /** The footer's count, such as "120 transactions"; past one page it follows "11–20 of". */
  rowCountLabel: string;
  /** Where this browser keeps the table's column choice; columns opt in with `enableHiding`. */
  columnsStorageKey: string;
  /** Content at the toolbar's start, such as the active filters' chips. */
  toolbarStart?: React.ReactNode;
  /** Controls at the toolbar's end, before Columns, such as a Filters popover. */
  toolbarEnd?: React.ReactNode;
  /** With no rows, shown under the toolbar in place of the header, rows and footer, such as a no-match message. */
  empty?: React.ReactNode;
  /** A last cell per row, such as its action menu; it sits above the row's stretched link. */
  renderRowActions?: (row: TData) => React.ReactNode;
}

/** The classes a column's meta sets, the same for its header and its cells. */
function columnMetaClass(
  meta: Readonly<{ align?: "end"; grow?: true; secondary?: true }> | undefined,
) {
  return cn(
    meta?.align === "end" && "text-right",
    meta?.grow && "w-full max-w-0",
    meta?.secondary && SECONDARY_COLUMN,
  );
}

const SORT_GLYPHS = { asc: ArrowUp, desc: ArrowDown };
const ARIA_SORTS = { asc: "ascending", desc: "descending" } as const;

function SortGlyph({ sorted }: Readonly<{ sorted: false | "asc" | "desc" }>) {
  const Glyph = sorted ? SORT_GLYPHS[sorted] : ChevronsUpDown;
  return (
    <Glyph
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn("size-3.5", !sorted && "opacity-60")}
    />
  );
}

export function HeaderCell<TData extends RowData>({
  header,
}: Readonly<{ header: Header<DataTableFeatures, TData, unknown> }>) {
  const { column } = header;
  const sorted = column.getIsSorted();
  const end = column.columnDef.meta?.align === "end";
  const label = column.columnDef.meta?.srOnlyHeader ? (
    <span className="sr-only">
      <FlexRender header={header} />
    </span>
  ) : (
    <FlexRender header={header} />
  );
  return (
    <TableHead
      aria-sort={sorted ? ARIA_SORTS[sorted] : undefined}
      className={columnMetaClass(column.columnDef.meta)}
    >
      {column.getCanSort() ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          // Merged, so the header's weight and Slate beat the Ghost button's.
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            // The label keeps the column's text edge.
            "text-muted-foreground -mx-2 px-2 font-medium",
            sorted && "text-foreground",
            end && "flex-row-reverse",
          )}
        >
          <FlexRender header={header} />
          <SortGlyph sorted={sorted} />
        </button>
      ) : (
        label
      )}
    </TableHead>
  );
}

interface CompactDataTableProps<TData extends RowData> {
  /** Names the table for assistive technology. */
  label: string;
  columns: readonly DataTableColumn<TData>[];
  rows: readonly TData[];
  rowId: (row: TData) => string;
  /** Attributes for one row's `tr`, such as a data hook or a highlight. */
  rowProps?: (row: TData) => RowProps;
}

interface DataTableBodyProps<TData extends RowData>
  extends Pick<DataTableProps<TData>, "renderRowActions"> {
  table: ReactTable<DataTableFeatures, TData>;
  rowProps: CompactDataTableProps<TData>["rowProps"];
}

/** A row, then the rows nested under it, so a tree reads as one flat list. */
function withSubRows<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
): Row<DataTableFeatures, TData>[] {
  return [row, ...row.subRows.flatMap(withSubRows)];
}

export function DataTableBody<TData extends RowData>({
  table,
  rowProps,
  renderRowActions,
}: Readonly<DataTableBodyProps<TData>>) {
  return (
    <TableBody>
      {table
        .getRowModel()
        .rows.flatMap(withSubRows)
        .map((row) => {
          const props = rowProps?.(row.original);
          return (
            <TableRow
              key={row.id}
              {...props}
              className={cn("hover:bg-accent/70", props?.className)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={columnMetaClass(cell.column.columnDef.meta)}
                >
                  <FlexRender cell={cell} />
                </TableCell>
              ))}
              {renderRowActions && (
                <TableCell className="relative z-1 w-px py-1.5 text-right">
                  {renderRowActions(row.original)}
                </TableCell>
              )}
            </TableRow>
          );
        })}
    </TableBody>
  );
}

/** The header rows, with an unlabelled last head above the row actions. */
export function DataTableHeaderRows<TData extends RowData>({
  table,
  hasRowActions = false,
}: Readonly<{
  table: ReactTable<DataTableFeatures, TData>;
  hasRowActions?: boolean;
}>) {
  return table.getHeaderGroups().map((group) => (
    <TableRow key={group.id}>
      {group.headers.map((header) => (
        <HeaderCell key={header.id} header={header} />
      ))}
      {hasRowActions && (
        <TableHead className="w-px">
          <span className="sr-only">Actions</span>
        </TableHead>
      )}
    </TableRow>
  ));
}

/**
 * A data table's columns and rows alone, for a short excerpt such as Home's
 * recent rows: no sorting, paging or footer, and the header scrolls with it.
 */
export function CompactDataTable<TData extends RowData>({
  label,
  columns,
  rows,
  rowId,
  rowProps,
}: Readonly<CompactDataTableProps<TData>>) {
  const table = useTable({
    features,
    columns: [...columns],
    data: [...rows],
    getRowId: rowId,
    enableSorting: false,
  });
  return (
    <Table aria-label={label}>
      <TableHeader>
        <DataTableHeaderRows table={table} />
      </TableHeader>
      <DataTableBody table={table} rowProps={rowProps} />
    </Table>
  );
}

/**
 * A desktop table that sorts and pages on the server: sortable headers, a
 * header row that stays in view, and a footer with the row count, rows per
 * page, and "Page X of Y" with first, previous, next and last.
 */
export function DataTable<TData extends RowData>({
  label,
  columns,
  rows,
  rowId,
  rowProps,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  pageSizes,
  rowCount,
  rowCountLabel,
  columnsStorageKey,
  toolbarStart,
  toolbarEnd,
  empty,
  renderRowActions,
}: Readonly<DataTableProps<TData>>) {
  const [columnVisibility, setColumnVisibility] = useStoredColumnVisibility(
    columnsStorageKey,
    columns.flatMap(({ id, enableHiding, meta }) =>
      id
        ? [
            {
              id,
              hideable: enableHiding ?? false,
              hiddenByDefault: meta?.hiddenByDefault ?? false,
            },
          ]
        : [],
    ),
  );
  const table = useTable({
    features,
    columns: [...columns],
    data: [...rows],
    getRowId: rowId,
    state: { sorting, pagination, columnVisibility },
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility(functionalUpdate(updater, columnVisibility)),
    onSortingChange: (updater) =>
      onSortingChange(functionalUpdate(updater, sorting)),
    onPaginationChange: (updater) =>
      onPaginationChange(functionalUpdate(updater, pagination)),
    manualSorting: true,
    manualPagination: true,
    rowCount,
    enableMultiSort: false,
    enableSortingRemoval: false,
    // An unsorted column's first click reads largest or newest first.
    sortDescFirst: true,
    defaultColumn: { enableSorting: false, enableHiding: false },
  });
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageSizeLabelId = useId();
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-4 pt-4 pb-1">
        <div className="min-w-0 flex-1 self-center">{toolbarStart}</div>
        <div className="flex shrink-0 items-center gap-2">
          {toolbarEnd}
          <ColumnsMenu
            columns={table.getAllLeafColumns().map((column) => ({
              id: column.id,
              label:
                typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id,
              visible: column.getIsVisible(),
              hideable: column.getCanHide(),
              setVisible: (visible) => column.toggleVisibility(visible),
            }))}
          />
        </div>
      </div>
      {rows.length === 0 && empty ? (
        <div className="pt-3 pb-6">{empty}</div>
      ) : (
        <>
          {/* No scroll box, so the header can stick under the 64px top bar. */}
          <Table aria-label={label} containerClassName="overflow-x-visible">
            <TableHeader className="bg-card sticky top-16 z-10 shadow-[-1.5rem_0_0_var(--card),1.5rem_0_0_var(--card)]">
              <DataTableHeaderRows
                table={table}
                hasRowActions={Boolean(renderRowActions)}
              />
            </TableHeader>
            <DataTableBody
              table={table}
              rowProps={rowProps}
              renderRowActions={renderRowActions}
            />
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t py-3">
            <p className="text-muted-foreground text-sm tabular-nums">
              {pageRangeLabel(pagination, { rowCount, rowCountLabel })}
            </p>
            <div className="ml-auto flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span
                  id={pageSizeLabelId}
                  className="text-muted-foreground text-sm"
                >
                  Rows per page
                </span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(size) =>
                    size && table.setPageSize(Number(size))
                  }
                >
                  <SelectTrigger
                    aria-labelledby={pageSizeLabelId}
                    className="w-20"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizes.map((size) => (
                      <SelectItem
                        key={size}
                        value={String(size)}
                        label={String(size)}
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p
                className="text-sm font-medium tabular-nums"
                aria-live="polite"
              >
                Page {pagination.pageIndex + 1} of {pageCount}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="First page"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.firstPage()}
                >
                  <ChevronFirst aria-hidden="true" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Last page"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.lastPage()}
                >
                  <ChevronLast aria-hidden="true" strokeWidth={1.75} />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
