import { Dialog } from "@base-ui/react/dialog";
import { sortFn_basic, sortFn_text } from "@tanstack/react-table";
import { EditTagSheet } from "@/features/tags/components/edit-tag-sheet";
import type { EditTagOutcome } from "@/features/tags/hooks/use-edit-tag-form";
import type { TagSummary } from "@/features/tags/tag-search";
import { ClientDataTable } from "@/shared/components/client-data-table";
import type { DataTableColumn } from "@/shared/components/data-table";
import { dataTableColumns } from "@/shared/components/data-table";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import { tableRowLinkClass } from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";
import { useEditingRow } from "@/shared/hooks/use-editing-row";

interface TagTableProps {
  tags: readonly TagSummary[];
  onDone: (tag: Readonly<TagSummary>, outcome: EditTagOutcome) => void;
}

const column = dataTableColumns<TagSummary>();

function tagColumns(
  edit: (tag: TagSummary) => void,
): readonly DataTableColumn<TagSummary>[] {
  return [
    column.accessor("name", {
      header: "Name",
      enableSorting: true,
      sortFn: sortFn_text,
      meta: { grow: true },
      cell: ({ row }) => (
        <button
          type="button"
          data-tag-row={row.original.id}
          title={row.original.name}
          onClick={() => edit(row.original)}
          className={cn(
            tableRowLinkClass,
            "block max-w-full truncate text-left font-semibold",
          )}
        >
          {row.original.name}
        </button>
      ),
    }),
    column.accessor("transactionCount", {
      id: "transactions",
      header: "Transactions",
      enableSorting: true,
      sortFn: sortFn_basic,
      meta: { align: "end" },
      cell: ({ getValue }) => (
        <span className="text-muted-foreground tabular-nums">{getValue()}</span>
      ),
    }),
  ];
}

/** Tags with how many transactions carry each; a row's name or menu opens its edit sheet. */
export function TagTable({ tags, onDone }: Readonly<TagTableProps>) {
  const editing = useEditingRow<TagSummary>();
  const tag = editing.row;
  return (
    <>
      <ClientDataTable
        label="Tags"
        columns={tagColumns(editing.edit)}
        rows={tags}
        rowId={(row) => row.id}
        rowProps={() => ({ className: "hover:bg-accent/70" })}
        rowActions={(row) => (
          <RowActionsMenu record={row.name}>
            <DropdownMenuItem onClick={() => editing.edit(row)}>
              Edit
            </DropdownMenuItem>
          </RowActionsMenu>
        )}
      />
      <Dialog.Root {...editing.rootProps}>
        {tag && (
          <EditTagSheet
            tag={tag}
            others={tags.filter((other) => other.id !== tag.id)}
            onDone={(outcome) => {
              editing.close();
              onDone(tag, outcome);
            }}
            onCancel={editing.close}
          />
        )}
      </Dialog.Root>
    </>
  );
}
