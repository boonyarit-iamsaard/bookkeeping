import type { RowData } from "@tanstack/react-table";
import { Ellipsis } from "lucide-react";
import type * as React from "react";
import type { DataTableColumn } from "@/shared/components/data-table";
import { dataTableColumns } from "@/shared/components/data-table";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  /** Names the record the menu acts on, e.g. "Cash". */
  record: string;
  /** `DropdownMenuItem`s, one per action the record already has. */
  children: React.ReactNode;
}

/** A table row's action menu: an ellipsis button above the row's stretched link. */
export function RowActionsMenu({
  record,
  children,
}: Readonly<RowActionsMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={`Actions for ${record}`}
            className="relative z-10 -my-2"
          />
        }
      >
        <Ellipsis aria-hidden="true" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The last column of a data table: each row's menu, under a header read only by assistive technology. */
export function actionsColumn<TData extends RowData>(
  menu: (row: TData) => React.ReactNode,
): DataTableColumn<TData> {
  return dataTableColumns<TData>().display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: "end" },
    cell: ({ row }) => menu(row.original),
  });
}
