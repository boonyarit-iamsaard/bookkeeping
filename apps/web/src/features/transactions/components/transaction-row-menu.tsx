import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { useQuery } from "@tanstack/react-query";
import { EllipsisVertical, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import type { components } from "@/core/api/openapi.gen";
import { transactionQueries } from "@/core/api/queries";
import { categoryLabel } from "@/features/categories/category-search";
import { canRecordRefund } from "@/features/transactions/linked-expense";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionRowMenuProps {
  transaction: Readonly<ApiTransaction>;
  onEdit: () => void;
  onRefund: () => void;
  onDelete: () => void;
}

/**
 * A row's actions: Edit, Refund and Delete. Refund is offered for an expense
 * once its refunds are read, and only while an allowance is left; the read
 * waits until the menu opens, so a page of rows costs no extra requests.
 */
export function TransactionRowMenu({
  transaction,
  onEdit,
  onRefund,
  onDelete,
}: Readonly<TransactionRowMenuProps>) {
  const [open, setOpen] = useState(false);
  const { data: refunds } = useQuery({
    ...transactionQueries.refunds(transaction.id),
    enabled: open && transaction.type === "expense",
  });
  const name = transaction.category
    ? categoryLabel(transaction.category)
    : TRANSACTION_TYPE_LABELS[transaction.type];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" />}
        // Above the row's stretched link, so the button is its own target.
        className="relative z-1"
        aria-label={`Actions for ${name} on ${formatCalendarDate(transaction.transactionDate)}`}
      >
        <EllipsisVertical aria-hidden="true" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil aria-hidden="true" strokeWidth={1.75} />
          Edit
        </DropdownMenuItem>
        {refunds && canRecordRefund(refunds) && (
          <DropdownMenuItem onClick={onRefund}>
            <Undo2 aria-hidden="true" strokeWidth={1.75} />
            Refund
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" strokeWidth={1.75} />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
