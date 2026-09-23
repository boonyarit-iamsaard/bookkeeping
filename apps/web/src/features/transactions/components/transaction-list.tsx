import {
  APP_TIME_ZONE,
  formatCalendarDate,
  formatInstant,
} from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, Plus, ReceiptText } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import { CategoryIcon } from "@/features/categories/components/category-icon";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionListProps {
  transactions: readonly ApiTransaction[];
  /** The transaction just saved, if any; it alone arrives with a fade. */
  savedId?: string;
}

export function TransactionList({
  transactions,
  savedId,
}: Readonly<TransactionListProps>) {
  if (transactions.length === 0) {
    return <EmptyTransactions />;
  }

  return (
    <ul className="-mx-4 divide-y sm:mx-0" aria-label="Transactions">
      {transactions.map((transaction) => (
        <li
          key={transaction.id}
          data-transaction-row
          data-saved={transaction.id === savedId || undefined}
          className={cn(
            transaction.id === savedId &&
              "motion-safe:fade-in motion-safe:animate-in motion-safe:duration-500",
          )}
        >
          <Link
            to="/transactions/$transactionId"
            params={{ transactionId: transaction.id }}
            className="flex min-h-16 flex-wrap items-center gap-4 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-0"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              {transaction.category ? (
                <CategoryIcon
                  iconId={transaction.category.iconId}
                  className="size-5"
                />
              ) : (
                <ArrowRightLeft
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5"
                />
              )}
            </span>
            <div className="min-w-32 flex-1">
              <p className="line-clamp-2 font-medium leading-snug">
                <span className="text-muted-foreground">
                  {TRANSACTION_TYPE_LABELS[transaction.type]}
                  {transaction.category ? " · " : ""}
                </span>
                {transaction.category
                  ? categoryLabel(transaction.category)
                  : ""}
              </p>
              {transaction.destinationWallet && (
                <p className="wrap-break-word text-muted-foreground text-sm">
                  {transaction.wallet.name}
                  {transaction.wallet.archived && " (Archived)"} →{" "}
                  {transaction.destinationWallet.name}
                  {transaction.destinationWallet.archived && " (Archived)"}
                </p>
              )}
              <p className="truncate text-muted-foreground text-sm">
                {!transaction.destinationWallet &&
                  `${transaction.wallet.name}${transaction.wallet.archived ? " (Archived)" : ""} · `}
                {formatCalendarDate(transaction.transactionDate)}
                {transaction.note && ` · ${transaction.note}`}
              </p>
              <p className="text-muted-foreground text-xs">
                Recorded{" "}
                {formatInstant({
                  instant: new Date(transaction.recordedAt),
                  timeZone: APP_TIME_ZONE,
                })}{" "}
                · Bangkok
              </p>
            </div>
            <Money
              amount={transaction.amount}
              sign={TRANSACTION_TYPE_SIGNS[transaction.type]}
              className="ml-auto shrink-0 text-lg"
            />
          </Link>
          {transaction.refundOf && (
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: transaction.refundOf.id }}
              className="mb-3 ml-18 inline-flex min-h-11 items-center rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              View original expense
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function EmptyTransactions() {
  return (
    <section
      aria-labelledby="empty-transactions-heading"
      className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-6 sm:p-8"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <ReceiptText aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="empty-transactions-heading" className="font-semibold text-lg">
          Nothing recorded yet
        </h2>
        <p className="max-w-prose text-muted-foreground text-sm leading-normal">
          Record income and expenses as they happen. Each one moves the balance
          of the wallet it belongs to.
        </p>
      </div>
      <Link to="/transactions/new" className={buttonVariants({ size: "lg" })}>
        <Plus data-icon="inline-start" />
        Record a transaction
      </Link>
    </section>
  );
}
