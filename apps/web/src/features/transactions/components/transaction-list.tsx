import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, Plus, ReceiptText } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { categoryLabel } from "@/features/categories/category-search";
import {
  CategoryIcon,
  CategoryTile,
} from "@/features/categories/components/category-icon";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_SIGNS,
} from "@/features/transactions/transaction-labels";
import { EmptyState } from "@/shared/components/empty-state";
import { listCardClass } from "@/shared/components/list-section";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

type ApiTransaction = components["schemas"]["Transaction"];
type ApiTransactionWallet = components["schemas"]["TransactionWallet"];

interface TransactionListProps {
  transactions: readonly ApiTransaction[];
  /** The transaction just saved, if any; it alone arrives with a fade. */
  savedId?: string;
  /** The wallet whose page lists these rows; they leave its name out. */
  pageWalletId?: string;
}

function walletName(wallet: ApiTransactionWallet) {
  return wallet.archived ? `${wallet.name} (Archived)` : wallet.name;
}

interface TransferWalletsOptions {
  source: ApiTransactionWallet;
  destination: ApiTransactionWallet;
  pageWalletId: string | undefined;
}

/** A transfer's wallets, naming only the other side on either wallet's page. */
function transferWallets({
  source,
  destination,
  pageWalletId,
}: Readonly<TransferWalletsOptions>) {
  if (source.id === pageWalletId) {
    return `To ${walletName(destination)}`;
  }
  if (destination.id === pageWalletId) {
    return `From ${walletName(source)}`;
  }
  return `${walletName(source)} → ${walletName(destination)}`;
}

function EmptyTransactions() {
  return (
    <EmptyState
      icon={ReceiptText}
      headingId="empty-transactions-heading"
      title="Nothing recorded yet"
      description="Record income and expenses as they happen. Each one moves the balance of the wallet it belongs to."
      action={
        <Link to="/transactions/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" />
          Record a transaction
        </Link>
      }
    />
  );
}

export function TransactionList({
  transactions,
  savedId,
  pageWalletId,
}: Readonly<TransactionListProps>) {
  const colorOf = useCategoryColors();
  if (transactions.length === 0) {
    return <EmptyTransactions />;
  }

  return (
    <ul className={listCardClass} aria-label="Transactions">
      {transactions.map((transaction) => {
        const color = transaction.category
          ? colorOf(transaction.category.id)
          : "neutral";
        return (
          <li
            key={transaction.id}
            data-transaction-row
            data-saved={transaction.id === savedId || undefined}
            data-hue={color}
            className={cn(
              transaction.id === savedId &&
                "motion-safe:fade-in motion-safe:slide-in-from-bottom-2 bg-[color-mix(in_oklch,var(--hue)_7%,var(--card))] motion-safe:animate-in motion-safe:duration-400 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: transaction.id }}
              className="flex min-h-16 items-center gap-3.5 px-4 py-3 outline-none transition-colors duration-150 hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset motion-reduce:transition-none"
            >
              <CategoryTile color={color}>
                {transaction.category ? (
                  <CategoryIcon iconId={transaction.category.iconId} />
                ) : (
                  <ArrowRightLeft aria-hidden="true" strokeWidth={1.75} />
                )}
              </CategoryTile>
              {/*
              Source order is title, details, figure, so the link reads as it
              always has. The figure sits beside the title, which wraps rather
              than clamps, and the details run the full width beneath.
            */}
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                <p className="wrap-break-word font-semibold leading-snug">
                  {TRANSACTION_TYPE_LABELS[transaction.type]}
                  {transaction.category ? " · " : ""}
                  {transaction.category
                    ? categoryLabel(transaction.category)
                    : ""}
                </p>
                <div className="col-span-2 row-start-2 mt-0.5 min-w-0">
                  {transaction.destinationWallet && (
                    <p className="wrap-break-word text-muted-foreground text-sm">
                      {transferWallets({
                        source: transaction.wallet,
                        destination: transaction.destinationWallet,
                        pageWalletId,
                      })}
                    </p>
                  )}
                  {/* The date keeps its width; only the wallet gives way. */}
                  <p className="flex text-muted-foreground text-sm">
                    <span className="shrink-0">
                      {formatCalendarDate(transaction.transactionDate)}
                    </span>
                    {!transaction.destinationWallet &&
                      transaction.wallet.id !== pageWalletId && (
                        <span className="min-w-0 truncate">
                          &nbsp;· {walletName(transaction.wallet)}
                        </span>
                      )}
                  </p>
                  {transaction.note && (
                    <p className="wrap-break-word line-clamp-2 text-muted-foreground text-sm">
                      {transaction.note}
                    </p>
                  )}
                </div>
                <Money
                  amount={transaction.amount}
                  sign={TRANSACTION_TYPE_SIGNS[transaction.type]}
                  className="col-start-2 row-start-1 self-start text-base leading-snug"
                />
              </div>
            </Link>
            {transaction.refundOf && (
              <Link
                to="/transactions/$transactionId"
                params={{ transactionId: transaction.refundOf.id }}
                className="mb-3 ml-[4.625rem] inline-flex min-h-11 items-center rounded-sm font-semibold text-link text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                View original expense
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
