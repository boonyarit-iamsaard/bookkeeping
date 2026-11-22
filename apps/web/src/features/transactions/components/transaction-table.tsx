import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import { TagChipList } from "@/features/tags/components/tag-chip";
import { transferWallets } from "@/features/transactions/components/transaction-list";
import { groupHistoryByMonth } from "@/features/transactions/history-groups";
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
  /** Splits the rows under a header row per month of their date. */
  groupByMonth?: boolean;
  /** The wallet whose page lists these rows: its column goes, and transfers name the other side. */
  pageWalletId?: string;
}

function walletName(wallet: ApiTransactionWallet) {
  return wallet.archived ? `${wallet.name} (Archived)` : wallet.name;
}

interface TransactionRowProps {
  transaction: Readonly<ApiTransaction>;
  savedId: string | undefined;
  pageWalletId: string | undefined;
}

function TransactionRow({
  transaction,
  savedId,
  pageWalletId,
}: Readonly<TransactionRowProps>) {
  const { destinationWallet } = transaction;
  const transfer = destinationWallet
    ? transferWallets({
        source: transaction.wallet,
        destination: destinationWallet,
        pageWalletId,
      })
    : null;
  return (
    <TableRow
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
          className="focus-visible:after:ring-ring/45 inline-flex items-center gap-1.5 outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
        >
          {transfer && (
            <ArrowRightLeft
              aria-hidden="true"
              strokeWidth={1.75}
              className="text-muted-foreground size-4 shrink-0"
            />
          )}
          {transaction.category
            ? categoryLabel(transaction.category)
            : TRANSACTION_TYPE_LABELS[transaction.type]}
        </Link>
        {/* Captions are text, not links: the row is the link. */}
        {transaction.type === "refund" && transaction.category && (
          <span className="text-muted-foreground block text-xs font-normal">
            Refund
          </span>
        )}
        {pageWalletId && transfer && (
          <span className="text-muted-foreground block text-xs font-normal">
            {transfer}
          </span>
        )}
      </TableCell>
      {!pageWalletId && (
        <TableCell>{transfer ?? walletName(transaction.wallet)}</TableCell>
      )}
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
  );
}

/**
 * Transactions as a table: date, category, wallet, tags, note and amount. The
 * category is the row's link, stretched over the whole row.
 */
export function TransactionTable({
  transactions,
  savedId,
  groupByMonth = false,
  pageWalletId,
}: Readonly<TransactionTableProps>) {
  const columns = pageWalletId ? 5 : 6;
  const groups = groupByMonth
    ? groupHistoryByMonth(transactions)
    : [{ key: "all", label: null, transactions }];
  return (
    <Table aria-label="Transactions">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          {!pageWalletId && <TableHead>Wallet</TableHead>}
          <TableHead>Tags</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      {groups.map((group) => (
        <TableBody key={group.key}>
          {group.label && (
            <TableRow data-month-row>
              <TableHead
                colSpan={columns}
                scope="colgroup"
                className="text-foreground bg-muted/50 px-3 font-bold first:pl-3 last:pr-3"
              >
                {group.label}
              </TableHead>
            </TableRow>
          )}
          {group.transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              savedId={savedId}
              pageWalletId={pageWalletId}
            />
          ))}
        </TableBody>
      ))}
    </Table>
  );
}
