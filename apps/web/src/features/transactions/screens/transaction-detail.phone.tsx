import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import {
  TransactionAmount,
  TransactionFacts,
} from "@/features/transactions/components/transaction-detail";
import {
  EditTransactionLink,
  ExpenseRefundsSection,
} from "@/features/transactions/components/transaction-detail-actions";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { listCardClass } from "@/shared/components/list-section";
import { HeroSkeleton, Skeleton } from "@/shared/components/skeleton";

interface TransactionDetailPhoneProps {
  transaction: components["schemas"]["Transaction"];
}

/** Edit and Record refund navigate to their own pages. */
export function TransactionDetailPhone({
  transaction,
}: Readonly<TransactionDetailPhoneProps>) {
  return (
    <Page layout="column">
      <TitleBar
        title={TRANSACTION_TYPE_LABELS[transaction.type]}
        back={<BackLink to="/transactions" aria-label="Back to Transactions" />}
        actions={<EditTransactionLink transactionId={transaction.id} />}
      />
      <TransactionAmount transaction={transaction} />
      <TransactionFacts transaction={transaction} />
      {transaction.type === "expense" && (
        <ExpenseRefundsSection
          transactionId={transaction.id}
          categoryId={transaction.category?.id}
          onRecordRefund={null}
        />
      )}
    </Page>
  );
}

/** A transaction's detail in neutral blocks: the hero, then its fact rows. */
export function TransactionDetailPhoneLoading() {
  return (
    <Page layout="column" loading>
      <output className="sr-only">Loading your records…</output>
      <TitleBar title={<Skeleton className="h-8 w-48" />} />
      <div aria-hidden="true" className="contents">
        <HeroSkeleton />
        <div className={listCardClass}>
          {["category", "wallet", "date", "note", "recorded"].map((row) => (
            <div key={row} className="flex min-h-16 flex-col gap-2 px-5 py-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
