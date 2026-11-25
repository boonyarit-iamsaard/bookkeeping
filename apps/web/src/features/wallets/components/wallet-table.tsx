import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import {
  WALLET_TYPE_LABELS,
  walletHeldAsLabel,
} from "@/features/wallets/wallet-labels";
import { SECONDARY_COLUMN } from "@/shared/components/data-table";
import { Money } from "@/shared/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  tableRowLinkClass,
} from "@/shared/components/ui/table";

type WalletSummary = components["schemas"]["Wallet"];
type ApiMoney = components["schemas"]["Money"];

interface WalletTableProps {
  /** The rows to list; the caller decides whether archived wallets are among them. */
  wallets: readonly WalletSummary[];
  /** The Total balance beneath the rows, which may cover wallets not listed; none without wallets. */
  total: ApiMoney | null;
}

/** Wallets by name, type, how their balance counts, and balance, with the Total balance beneath. */
export function WalletTable({ wallets, total }: Readonly<WalletTableProps>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Wallet</TableHead>
          <TableHead className={SECONDARY_COLUMN}>Type</TableHead>
          <TableHead className={SECONDARY_COLUMN}>Held as</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {wallets.map((wallet) => (
          <TableRow
            key={wallet.id}
            data-wallet-row
            className="has-[a:hover]:bg-accent/70"
          >
            <TableCell className="font-semibold">
              <Link
                to="/wallets/$walletId"
                params={{ walletId: wallet.id }}
                className={tableRowLinkClass}
              >
                {wallet.name}
              </Link>
            </TableCell>
            <TableCell className={SECONDARY_COLUMN}>
              {WALLET_TYPE_LABELS[wallet.type]}
            </TableCell>
            <TableCell className={SECONDARY_COLUMN}>
              {walletHeldAsLabel(wallet)}
            </TableCell>
            <TableCell className="text-right">
              <Money amount={wallet.balance} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      {total && (
        <TableFooter>
          <TableRow>
            <TableCell>Total balance</TableCell>
            <TableCell colSpan={2} className={SECONDARY_COLUMN} />
            <TableCell className="text-right">
              <Money amount={total} />
            </TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
