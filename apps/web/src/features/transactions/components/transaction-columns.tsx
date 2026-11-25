import { formatCalendarDate } from "@bookkeeping/domain/dates";
import type { components } from "@/core/api/openapi.gen";
import { TagChipList } from "@/features/tags/components/tag-chip";
import { transferWallets } from "@/features/transactions/components/transaction-list";
import {
  TransactionCategoryCell,
  walletName,
} from "@/features/transactions/components/transaction-table";
import { TRANSACTION_TYPE_SIGNS } from "@/features/transactions/transaction-labels";
import type { DataTableColumn } from "@/shared/components/data-table";
import { dataTableColumns } from "@/shared/components/data-table";
import { Money } from "@/shared/components/money";
import { ARRIVAL_CLASS } from "@/shared/helpers/arrival";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];

function transferOf(transaction: Readonly<ApiTransaction>) {
  return transaction.destinationWallet
    ? transferWallets({
        source: transaction.wallet,
        destination: transaction.destinationWallet,
        pageWalletId: undefined,
      })
    : null;
}

const column = dataTableColumns<ApiTransaction>();

/**
 * Desktop Transactions' columns. Date and Amount sort on the server under the
 * list's own sort names; the category is the row's link.
 */
export const TRANSACTION_COLUMNS: readonly DataTableColumn<ApiTransaction>[] = [
  column.accessor("transactionDate", {
    id: "date",
    header: "Date",
    enableSorting: true,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatCalendarDate(getValue())}
      </span>
    ),
  }),
  column.display({
    id: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="font-semibold">
        <TransactionCategoryCell
          transaction={row.original}
          transfer={transferOf(row.original)}
          showTransfer={false}
        />
      </span>
    ),
  }),
  column.display({
    id: "wallet",
    header: "Wallet",
    cell: ({ row }) =>
      transferOf(row.original) ?? walletName(row.original.wallet),
  }),
  column.display({
    id: "tags",
    header: "Tags",
    cell: ({ row }) => <TagChipList tags={row.original.tags} />,
  }),
  column.accessor("note", {
    header: "Note",
    meta: { grow: true },
    cell: ({ getValue }) => (
      <span className="text-muted-foreground block truncate">{getValue()}</span>
    ),
  }),
  column.accessor("amount", {
    id: "amount",
    header: "Amount",
    enableSorting: true,
    meta: { align: "end" },
    cell: ({ row }) => (
      <Money
        amount={row.original.amount}
        sign={TRANSACTION_TYPE_SIGNS[row.original.type]}
      />
    ),
  }),
];

/** Home's recent rows: enough to recognise each, the rest one click away. */
export const RECENT_TRANSACTION_COLUMNS = TRANSACTION_COLUMNS.filter(
  (definition) =>
    ["date", "category", "wallet", "amount"].includes(definition.id ?? ""),
).map((definition) =>
  definition.id === "wallet"
    ? { ...definition, meta: { secondary: true as const } }
    : definition,
);

/** A transaction row's hooks and hover, the one just saved arriving with a fade. */
export function transactionRowProps(savedId: string | undefined) {
  return (transaction: Readonly<ApiTransaction>) => ({
    "data-transaction-row": true,
    "data-saved": transaction.id === savedId || undefined,
    className: cn(
      "has-[a:hover]:bg-accent/70",
      transaction.id === savedId && [ARRIVAL_CLASS, "bg-primary/7"],
    ),
  });
}
