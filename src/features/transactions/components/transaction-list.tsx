import { Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/features/categories/components/category-icon";
import { SignedMoney } from "@/features/transactions/components/signed-money";
import type { TransactionDetail } from "@/features/transactions/server/operations";
import { categoryLabel } from "@/features/transactions/transaction-types";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";
import { formatCalendarDate } from "@/shared/helpers/dates";

interface TransactionListProps {
  transactions: readonly TransactionDetail[];
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
            href={`/transactions/${transaction.id}`}
            className="flex min-h-16 items-center gap-4 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-0"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <CategoryIcon
                iconId={transaction.category.iconId}
                className="size-5"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium leading-snug">
                {categoryLabel(transaction.category)}
              </p>
              <p className="truncate text-muted-foreground text-sm">
                {transaction.wallet.name} ·{" "}
                {formatCalendarDate(transaction.transactionDate)}
                {transaction.note && ` · ${transaction.note}`}
              </p>
            </div>
            <SignedMoney
              transaction={transaction}
              className="shrink-0 text-lg"
            />
          </Link>
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
      <Link href="/transactions/new" className={buttonVariants({ size: "lg" })}>
        <Plus data-icon="inline-start" />
        Record a transaction
      </Link>
    </section>
  );
}
