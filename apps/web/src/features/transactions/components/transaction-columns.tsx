import { formatCalendarDate } from "@bookkeeping/domain/dates";
import type { components } from "@/core/api/openapi.gen";
import { transferWallets } from "@/features/transactions/components/transaction-list";
import {
  TransactionCategoryCell,
  walletName,
} from "@/features/transactions/components/transaction-table";
import { TransactionTagsCell } from "@/features/transactions/components/transaction-tags-cell";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import type { DataTableColumn } from "@/shared/components/data-table";
import { dataTableColumns } from "@/shared/components/data-table";
import { Money } from "@/shared/components/money";
import { ARRIVAL_CLASS } from "@/shared/helpers/arrival";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];

function transferOf(
  transaction: Readonly<ApiTransaction>,
  pageWalletId: string | undefined,
) {
  return transaction.destinationWallet
    ? transferWallets({
        source: transaction.wallet,
        destination: transaction.destinationWallet,
        pageWalletId,
      })
    : null;
}

const column = dataTableColumns<ApiTransaction>();

/**
 * Desktop Transactions' columns. Date and Amount sort on the server under the
 * list's own sort names; the category is the row's link. Date and Category
 * always show, so every row stays identifiable; the rest the owner may hide.
 * On a wallet's page the Wallet column goes and a transfer names the other side.
 */
export function transactionColumns(
  pageWalletId?: string,
): readonly DataTableColumn<ApiTransaction>[] {
  return [
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
      cell: ({ row, table }) => (
        <span className="font-semibold">
          <TransactionCategoryCell
            transaction={row.original}
            transfer={transferOf(row.original, pageWalletId)}
            // A hidden or absent Wallet column moves a transfer's wallets here.
            showTransfer={
              Boolean(pageWalletId) ||
              !table.getColumn("wallet")?.getIsVisible()
            }
          />
        </span>
      ),
    }),
    column.display({
      id: "wallet",
      header: "Wallet",
      enableHiding: true,
      cell: ({ row }) => {
        const wallet =
          transferOf(row.original, pageWalletId) ??
          walletName(row.original.wallet);
        // Category never truncates, so a long wallet gives way instead.
        return (
          <span title={wallet} className="block max-w-48 truncate">
            {wallet}
          </span>
        );
      },
    }),
    column.display({
      id: "type",
      header: "Type",
      enableHiding: true,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {TRANSACTION_TYPE_LABELS[row.original.type]}
        </span>
      ),
    }),
    column.display({
      id: "tags",
      header: "Tags",
      enableHiding: true,
      // Takes the spare width while Note, the other filler, is hidden.
      meta: { grow: true },
      // A transfer carries no tags.
      cell: ({ row }) =>
        row.original.type === "transfer" ? null : (
          <TransactionTagsCell
            tags={row.original.tags}
            pageWalletId={pageWalletId}
          />
        ),
    }),
    column.accessor("note", {
      id: "note",
      header: "Note",
      enableHiding: true,
      meta: { grow: true, hiddenByDefault: true },
      cell: ({ getValue }) => (
        <span className="text-muted-foreground block truncate">
          {getValue()}
        </span>
      ),
    }),
    column.accessor("amount", {
      id: "amount",
      header: "Amount",
      enableHiding: true,
      enableSorting: true,
      meta: { align: "end" },
      cell: ({ row }) => (
        <Money
          amount={row.original.amount}
          sign={TRANSACTION_TYPE_SIGNS[row.original.type]}
        />
      ),
    }),
  ].filter((definition) => !(pageWalletId && definition.id === "wallet"));
}

export const TRANSACTION_COLUMNS = transactionColumns();

/** Home's recent rows: enough to recognise each, the rest one click away. */
export const RECENT_TRANSACTION_COLUMNS = TRANSACTION_COLUMNS.filter(
  (definition) =>
    ["date", "category", "wallet", "amount"].includes(definition.id ?? ""),
).map((definition) =>
  definition.id === "wallet"
    ? { ...definition, meta: { secondary: true as const } }
    : definition,
);

/** A transaction row's hooks, the one just saved arriving with a fade. */
export function transactionRowProps(savedId: string | undefined) {
  return (transaction: Readonly<ApiTransaction>) => ({
    "data-transaction-row": true,
    "data-saved": transaction.id === savedId || undefined,
    className: cn(
      transaction.id === savedId && [ARRIVAL_CLASS, "bg-primary/7"],
    ),
  });
}
