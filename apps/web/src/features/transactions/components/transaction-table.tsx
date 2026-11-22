import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import { TagChipList } from "@/features/tags/components/tag-chip";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { Money } from "@/shared/components/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ARRIVAL_CLASS } from "@/shared/helpers/arrival";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionWallet = components["schemas"]["TransactionWallet"];

interface TransactionTableProps {
  transactions: readonly ApiTransaction[];
  /** The transaction just saved, if any; it alone arrives with a fade. */
  savedId?: string;
}

function walletName(wallet: ApiTransactionWallet) {
  return wallet.archived ? `${wallet.name} (Archived)` : wallet.name;
}

function walletsOf(transaction: Readonly<ApiTransaction>) {
  return transaction.destinationWallet
    ? `${walletName(transaction.wallet)} → ${walletName(transaction.destinationWallet)}`
    : walletName(transaction.wallet);
}

/**
 * Transactions as a table: date, category, wallet, tags, note and amount. The
 * category is the row's link, stretched over the whole row.
 */
export function TransactionTable({
  transactions,
  savedId,
}: Readonly<TransactionTableProps>) {
  return (
    <Table aria-label="Transactions">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Wallet</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow
            key={transaction.id}
            data-transaction-row
            data-saved={transaction.id === savedId || undefined}
            className={cn(
              "has-[a:hover]:bg-accent/70",
              transaction.id === savedId && [ARRIVAL_CLASS, "bg-primary/7"],
            )}
          >
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {formatCalendarDate(transaction.transactionDate)}
            </TableCell>
            <TableCell className="font-semibold">
              <Link
                to="/transactions/$transactionId"
                params={{ transactionId: transaction.id }}
                className="focus-visible:after:ring-ring/45 outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
              >
                {transaction.category
                  ? categoryLabel(transaction.category)
                  : TRANSACTION_TYPE_LABELS[transaction.type]}
              </Link>
            </TableCell>
            <TableCell>{walletsOf(transaction)}</TableCell>
            <TableCell>
              <TagChipList tags={transaction.tags} />
            </TableCell>
            <TableCell className="text-muted-foreground max-w-64 truncate">
              {transaction.note}
            </TableCell>
            <TableCell className="text-right">
              <Money
                amount={transaction.amount}
                sign={TRANSACTION_TYPE_SIGNS[transaction.type]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
