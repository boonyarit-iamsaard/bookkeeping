import {
  APP_TIME_ZONE,
  formatCalendarDate,
  formatInstant,
} from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
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
import { WALLET_TYPE_LABELS } from "@/features/wallets/wallet-labels";
import { DisplayFigure } from "@/shared/components/display-figure";
import { listCardClass } from "@/shared/components/list-section";
import { Money } from "@/shared/components/money";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionDetailViewProps {
  transaction: ApiTransaction;
}

function walletTerm(transaction: Readonly<ApiTransaction>) {
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
  const colorOf = useCategoryColors();
  return (
    <div className="flex flex-col gap-8">
      <DisplayFigure
        amount={transaction.amount}
        sign={TRANSACTION_TYPE_SIGNS[transaction.type]}
        heading="Amount"
        headingId="transaction-amount-heading"
        caption={`${TRANSACTION_TYPE_LABELS[transaction.type]} · ${formatCalendarDate(transaction.transactionDate)}`}
      />

      <dl className={listCardClass}>
        {transaction.refundOf && (
          <Row term="Refund of">
            <Link
              to="/transactions/$transactionId"
              params={{ transactionId: transaction.refundOf.id }}
              className="font-semibold text-link underline underline-offset-4"
            >
              <Money amount={transaction.refundOf.amount} sign="−" /> on{" "}
              {formatCalendarDate(transaction.refundOf.transactionDate)}
            </Link>
          </Row>
        )}
        {transaction.category && (
          <Row term="Category">
            <span className="flex items-center gap-3">
              <CategoryTile color={colorOf(transaction.category.id)}>
                <CategoryIcon iconId={transaction.category.iconId} />
              </CategoryTile>
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
            instant: new Date(transaction.recordedAt),
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
    <div className="flex min-h-16 flex-col justify-center gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-start sm:gap-6 sm:px-7">
      <dt className="text-muted-foreground text-sm sm:w-28 sm:shrink-0">
        {term}
      </dt>
      <dd className="wrap-break-word min-w-0 font-semibold">{children}</dd>
    </div>
  );
}
