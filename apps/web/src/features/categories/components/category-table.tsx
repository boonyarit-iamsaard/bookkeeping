import { Dialog } from "@base-ui/react/dialog";
import type { CategorySummary } from "@bookkeeping/domain/categories";
import { sortFn_basic, sortFn_text } from "@tanstack/react-table";
import type { CategoryColor } from "@/features/categories/category-color";
import type { CategoryGroup } from "@/features/categories/category-search";
import type { EditResult } from "@/features/categories/components/edit-category-sheet";
import { EditCategorySheet } from "@/features/categories/components/edit-category-sheet";
import { EditCategoryFormDesktop } from "@/features/categories/screens/edit-category-form.desktop";
import { ClientDataTable } from "@/shared/components/client-data-table";
import type { DataTableColumn } from "@/shared/components/data-table";
import { dataTableColumns } from "@/shared/components/data-table";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import { tableRowLinkClass } from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";
import { useEditingRow } from "@/shared/hooks/use-editing-row";

interface CategoryTableProps {
  /** Names the table, e.g. "Expense categories". */
  label: string;
  groups: readonly CategoryGroup[];
  colorOf: (parentId: string) => CategoryColor;
  /** Current entry counts by category id; absent means none. */
  usage: Readonly<Record<string, number>>;
  onDone: (result: Readonly<EditResult>) => void;
}

/** A category as a row: its children nest under it, each level sorted among its own. */
interface CategoryRow {
  category: CategorySummary;
  color: CategoryColor;
  parentName: string | null;
  childCount: number;
  entries: number;
  children: readonly CategoryRow[];
}

const column = dataTableColumns<CategoryRow>();

function categoryColumns(
  edit: (row: CategoryRow) => void,
): readonly DataTableColumn<CategoryRow>[] {
  return [
    column.accessor((row) => row.category.name, {
      id: "name",
      header: "Name",
      enableSorting: true,
      sortFn: sortFn_text,
      meta: { grow: true },
      cell: ({ row }) => (
        <button
          type="button"
          data-category-row={row.original.category.id}
          title={row.original.category.name}
          onClick={() => edit(row.original)}
          // A child sits one step in under its parent.
          className={cn(
            tableRowLinkClass,
            "block truncate text-left",
            row.depth === 0
              ? "max-w-full font-semibold"
              : "ms-8 max-w-[calc(100%-2rem)]",
          )}
        >
          {row.original.category.name}
        </button>
      ),
    }),
    column.accessor("entries", {
      header: "Entries",
      enableSorting: true,
      sortFn: sortFn_basic,
      meta: { align: "end" },
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{getValue()}</span>
      ),
    }),
  ];
}

/** One tree as a table: Name and Entries, each child one step in under its parent. */
export function CategoryTable({
  label,
  groups,
  colorOf,
  usage,
  onDone,
}: Readonly<CategoryTableProps>) {
  const editing = useEditingRow<CategoryRow>();
  const edited = editing.row;
  const rows = groups.map(({ parent, children }): CategoryRow => {
    const color = colorOf(parent.id);
    return {
      category: parent,
      color,
      parentName: null,
      childCount: children.length,
      entries: usage[parent.id] ?? 0,
      children: children.map((child) => ({
        category: child,
        color,
        parentName: parent.name,
        childCount: 0,
        entries: usage[child.id] ?? 0,
        children: [],
      })),
    };
  });
  return (
    <>
      <ClientDataTable
        label={label}
        columns={categoryColumns(editing.edit)}
        rows={rows}
        rowId={(row) => row.category.id}
        subRows={(row) => row.children}
        rowProps={() => ({ className: "hover:bg-accent/70" })}
        rowActions={(row) => (
          <RowActionsMenu record={row.category.name}>
            <DropdownMenuItem onClick={() => editing.edit(row)}>
              Edit
            </DropdownMenuItem>
          </RowActionsMenu>
        )}
      />
      <Dialog.Root {...editing.rootProps}>
        {edited && (
          <EditCategorySheet
            formComponent={EditCategoryFormDesktop}
            category={edited.category}
            color={edited.color}
            removal={{
              parentName: edited.parentName,
              childCount: edited.childCount,
              entries: edited.entries,
            }}
            onDone={(result) => {
              editing.close();
              onDone(result);
            }}
            onCancel={editing.close}
          />
        )}
      </Dialog.Root>
    </>
  );
}
