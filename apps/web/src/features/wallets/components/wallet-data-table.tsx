import { Link } from "@tanstack/react-router";
import { sortFn_basic, sortFn_text } from "@tanstack/react-table";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import {
  WALLET_TYPE_LABELS,
  walletHeldAsLabel,
} from "@/features/wallets/wallet-labels";
import { ClientDataTable } from "@/shared/components/client-data-table";
import type { DataTableColumn } from "@/shared/components/data-table";
import {
  dataTableColumns,
  SECONDARY_COLUMN,
} from "@/shared/components/data-table";
import { Money } from "@/shared/components/money";
import { RowActionsMenu } from "@/shared/components/row-actions-menu";
import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import {
  TableCell,
  TableRow,
  tableRowLinkClass,
} from "@/shared/components/ui/table";
import { cn } from "@/shared/helpers/cn";

type WalletSummary = components["schemas"]["Wallet"];
type ApiMoney = components["schemas"]["Money"];

interface WalletDataTableProps {
  wallets: readonly WalletSummary[];
  /** The Total balance beneath the rows, which may cover wallets not listed; none without wallets. */
  total: ApiMoney | null;
}

const column = dataTableColumns<WalletSummary>();

const WALLET_COLUMNS: readonly DataTableColumn<WalletSummary>[] = [
  column.accessor("name", {
    header: "Wallet",
    enableSorting: true,
    sortFn: sortFn_text,
    meta: { grow: true },
    cell: ({ row }) => (
      <span className="font-semibold">
        <Link
          to="/wallets/$walletId"
          params={{ walletId: row.original.id }}
          title={row.original.name}
          className={cn(tableRowLinkClass, "block truncate")}
        >
          {row.original.name}
        </Link>
        {/* A caption is text, not a link: the row is the link. */}
        {row.original.archivedAt && (
          <span className="text-muted-foreground block text-sm font-normal">
            Archived
          </span>
        )}
      </span>
    ),
  }),
  column.accessor((wallet) => WALLET_TYPE_LABELS[wallet.type], {
    id: "type",
    header: "Type",
    enableSorting: true,
    sortFn: sortFn_text,
    meta: { secondary: true },
  }),
  column.accessor((wallet) => walletHeldAsLabel(wallet), {
    id: "heldAs",
    header: "Held as",
    enableSorting: true,
    sortFn: sortFn_text,
    meta: { secondary: true },
  }),
  column.accessor((wallet) => parseApiMoney(wallet.balance), {
    id: "balance",
    header: "Balance",
    enableSorting: true,
    sortFn: sortFn_basic,
    meta: { align: "end" },
    cell: ({ row }) => <Money amount={row.original.balance} />,
  }),
];

/** Every wallet as a sortable table, the Total balance in its footer; each row's menu opens or manages it. */
export function WalletDataTable({
  wallets,
  total,
}: Readonly<WalletDataTableProps>) {
  return (
    <ClientDataTable
      label="Wallets"
      columns={WALLET_COLUMNS}
      rows={wallets}
      rowId={(wallet) => wallet.id}
      renderRowActions={(wallet) => (
        <RowActionsMenu record={wallet.name}>
          <DropdownMenuItem
            render={
              <Link to="/wallets/$walletId" params={{ walletId: wallet.id }} />
            }
          >
            Open
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                to="/wallets/$walletId/manage"
                params={{ walletId: wallet.id }}
              />
            }
          >
            Manage
          </DropdownMenuItem>
        </RowActionsMenu>
      )}
      rowProps={() => ({ "data-wallet-row": true })}
      footer={
        total && (
          <TableRow>
            <TableCell>Total balance</TableCell>
            <TableCell colSpan={2} className={SECONDARY_COLUMN} />
            <TableCell className="text-right">
              <Money amount={total} />
            </TableCell>
            <TableCell />
          </TableRow>
        )
      }
    />
  );
}
