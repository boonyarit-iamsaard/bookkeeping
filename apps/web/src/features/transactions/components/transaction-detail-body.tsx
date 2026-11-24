import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { transactionQueries } from "@/core/api/queries";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";

interface ExpenseRefundsSectionProps {
  transactionId: string;
  categoryId: string | undefined;
  onRecordRefund: (() => void) | null;
}

function ExpenseRefundsSection({
  transactionId,
  categoryId,
  onRecordRefund,
}: Readonly<ExpenseRefundsSectionProps>) {
  const colorOf = useCategoryColors();
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(transactionId),
  );
  return (
    <ExpenseRefundsView
      expense={{ id: transactionId }}
      refunds={refunds}
      color={categoryId ? colorOf(categoryId) : "neutral"}
      onRecordRefund={onRecordRefund}
    />
  );
}

interface TransactionDetailBodyProps {
  transaction: components["schemas"]["Transaction"];
  /** Opens Edit in place of navigating to its page; null navigates. */
  onEdit: (() => void) | null;
  /** Opens Record refund in place of navigating to its page; null navigates. */
  onRecordRefund: (() => void) | null;
}

/** A transaction's title bar, facts and an expense's refunds. */
export function TransactionDetailBody({
  transaction,
  onEdit,
  onRecordRefund,
}: Readonly<TransactionDetailBodyProps>) {
  return (
    <>
      <TitleBar
        title={TRANSACTION_TYPE_LABELS[transaction.type]}
        back={<BackLink to="/transactions" aria-label="Back to Transactions" />}
        actions={
          <Link
            to="/transactions/$transactionId/edit"
            params={{ transactionId: transaction.id }}
            onClick={openInPlace(onEdit)}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Pencil data-icon="inline-start" strokeWidth={1.75} />
            Edit
          </Link>
        }
      />
      <TransactionDetailView transaction={transaction} />
      {transaction.type === "expense" && (
        <ExpenseRefundsSection
          transactionId={transaction.id}
          categoryId={transaction.category?.id}
          onRecordRefund={onRecordRefund}
        />
      )}
    </>
  );
}
