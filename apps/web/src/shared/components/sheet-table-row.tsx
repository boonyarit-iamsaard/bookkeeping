import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import {
  TableCell,
  TableRow,
  tableRowLinkClass,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";

interface SheetTableRowProps {
  /** Marks the name's button, e.g. `{ "data-tag-row": id }`. */
  marker: Record<`data-${string}`, string>;
  name: string;
  /** Styles the name's cell: its weight, or its indent under a parent. */
  nameClassName?: string;
  /** The right-hand count. */
  count: number;
  /** The sheet this row opens; `close` shuts it, for when it is done. */
  sheet: (close: () => void) => React.ReactNode;
}

/** A table row that opens a sheet: its name is the button, stretched over the row. */
export function SheetTableRow({
  marker,
  name,
  nameClassName,
  count,
  sheet,
}: Readonly<SheetTableRowProps>) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <TableRow className="has-[button:hover]:bg-accent/70">
        <TableCell className={nameClassName}>
          <Dialog.Trigger
            {...marker}
            className={cn("text-left", tableRowLinkClass)}
          >
            {name}
          </Dialog.Trigger>
        </TableCell>
        <TableCell className="text-muted-foreground text-right tabular-nums">
          {count}
        </TableCell>
      </TableRow>
      {sheet(() => setOpen(false))}
    </Dialog.Root>
  );
}
