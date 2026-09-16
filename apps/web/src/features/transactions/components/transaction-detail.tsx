import Link from "next/link";
import { categoryLabel } from "@/features/categories/category-search";
import { CategoryIcon } from "@/features/categories/components/category-icon";
import { SignedMoney } from "@/features/transactions/components/signed-money";
import type { TransactionDetail } from "@/features/transactions/transaction.types";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction.types";
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet.types";
import {
  APP_TIME_ZONE,
  formatCalendarDate,
  formatInstant,
} from "@/shared/helpers/dates";
import { formatMoney } from "@/shared/helpers/money";

interface TransactionDetailViewProps {
  transaction: TransactionDetail;
}

function walletTerm(transaction: Readonly<TransactionDetail>) {
  if (transaction.destinationWallet) {
    return "From";
  }

  if (transaction.refundOf) {
    return "Received in";
  }

  return "Wallet";
}

export function TransactionDetailView({
  transaction,
}: Readonly<TransactionDetailViewProps>) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="transaction-amount-heading">
        <h2 id="transaction-amount-heading" className="sr-only">
          Amount
        </h2>
        <p className="text-4xl leading-none sm:text-5xl">
          <SignedMoney transaction={transaction} display />
        </p>
        <p className="mt-2 text-muted-foreground text-sm">
          {TRANSACTION_TYPE_LABELS[transaction.type]} ·{" "}
          {formatCalendarDate(transaction.transactionDate)}
        </p>
      </section>

      <dl className="-mx-4 divide-y sm:mx-0">
        {transaction.refundOf && (
          <Row term="Refund of">
            <Link
              href={`/transactions/${transaction.refundOf.id}`}
              className="underline underline-offset-4"
            >
              <span className="money" translate="no">
                −
                {formatMoney({
                  amountInMinorUnits: transaction.refundOf.amount,
                  currency: transaction.currency,
                })}
              </span>{" "}
              on {formatCalendarDate(transaction.refundOf.transactionDate)}
            </Link>
          </Row>
        )}
        {transaction.category && (
          <Row term="Category">
            <span className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <CategoryIcon
                  iconId={transaction.category.iconId}
                  className="size-5"
                />
              </span>
              {categoryLabel(transaction.category)}
            </span>
          </Row>
        )}
        <Row term={walletTerm(transaction)}>
          {transaction.wallet.name}
          <span className="text-muted-foreground">
            {" "}
            · {WALLET_TYPE_LABELS[transaction.wallet.type]}
            {transaction.wallet.archived && " · Archived"}
          </span>
        </Row>
        {transaction.destinationWallet && (
          <Row term="To">
            {transaction.destinationWallet.name}
            <span className="text-muted-foreground">
              {" "}
              · {WALLET_TYPE_LABELS[transaction.destinationWallet.type]}
              {transaction.destinationWallet.archived && " · Archived"}
            </span>
          </Row>
        )}
        <Row term="Date">{formatCalendarDate(transaction.transactionDate)}</Row>
        <Row term="Note">
          {transaction.note || (
            <span className="text-muted-foreground">No note</span>
          )}
        </Row>
        <Row term="Recorded">
          {formatInstant({
            instant: transaction.recordedAt,
            timeZone: APP_TIME_ZONE,
          })}
          <span className="text-muted-foreground"> Bangkok time</span>
        </Row>
      </dl>
    </div>
  );
}

interface RowProps {
  term: string;
  children: React.ReactNode;
}

function Row({ term, children }: Readonly<RowProps>) {
  return (
    <div className="flex min-h-16 flex-col justify-center gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-start sm:gap-6 sm:px-0">
      <dt className="text-muted-foreground text-sm sm:w-28 sm:shrink-0">
        {term}
      </dt>
      <dd className="wrap-break-word min-w-0 font-medium">{children}</dd>
    </div>
  );
}
