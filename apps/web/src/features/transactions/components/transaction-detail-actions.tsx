import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { transactionQueries } from "@/core/api/queries";
import { useCategoryColors } from "@/features/categories/hooks/use-category-colors";
import { ExpenseRefundsView } from "@/features/transactions/components/expense-refunds";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";

interface ExpenseRefundsSectionProps {
  transactionId: string;
  categoryId: string | undefined;
  onRecordRefund: (() => void) | null;
}

export function ExpenseRefundsSection({
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

interface EditTransactionLinkProps {
  transactionId: string;
  onOpen?: () => void;
}

export function EditTransactionLink({
  transactionId,
  onOpen,
}: Readonly<EditTransactionLinkProps>) {
  return (
    <Link
      to="/transactions/$transactionId/edit"
      params={{ transactionId }}
      onClick={openInPlace(onOpen)}
      className={buttonVariants({ variant: "outline", size: "lg" })}
    >
      <Pencil data-icon="inline-start" strokeWidth={1.75} />
      Edit
    </Link>
  );
}
