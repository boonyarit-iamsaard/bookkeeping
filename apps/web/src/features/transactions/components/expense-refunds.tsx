import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import type { CategoryColor } from "@/features/categories/category-color";
import { CategoryTile } from "@/features/categories/components/category-icon";
import { ListSection, listCardClass } from "@/shared/components/list-section";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";

type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface ExpenseRefundsViewProps {
  expense: Pick<components["schemas"]["Transaction"], "id">;
  refunds: ApiTransactionRefunds;
  /** The expense's category hue, which its refunds follow. */
  color: CategoryColor;
}

/** Shows linked refunds and the allowance returned by the API for an expense. */
export function ExpenseRefundsView({
  expense,
  refunds,
  color,
}: Readonly<ExpenseRefundsViewProps>) {
  const canRecordRefund = parseApiMoney(refunds.refundAllowance) > 0n;
  return (
    <ListSection
      headingId="expense-refunds-heading"
      heading="Refunds"
      action={
        canRecordRefund ? (
          <Link
            to="/transactions/$transactionId/refund"
            params={{ transactionId: expense.id }}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Undo2 data-icon="inline-start" strokeWidth={1.75} />
            Record refund
          </Link>
        ) : (
          <p className="font-semibold text-sm">Fully refunded</p>
        )
      }
    >
      <p className="-mt-1 pl-1 text-muted-foreground text-sm leading-normal">
        {refunds.refunds.length === 0 ? (
          "None recorded. A refund returns part or all of this expense."
        ) : (
          <>
            <Money amount={refunds.refundedTotal} /> refunded ·{" "}
            <Money amount={refunds.refundAllowance} /> left
          </>
        )}
      </p>
      {refunds.refunds.length > 0 && (
        <ul className={listCardClass} aria-label="Linked refunds">
          {refunds.refunds.map((refund) => (
            <li key={refund.id}>
              <Link
                to="/transactions/$transactionId"
                params={{ transactionId: refund.id }}
                className="flex min-h-16 items-center gap-3.5 px-4 py-3 outline-none transition-colors duration-150 hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset motion-reduce:transition-none"
              >
                <CategoryTile color={color}>
                  <Undo2 aria-hidden="true" strokeWidth={1.75} />
                </CategoryTile>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">
                    {formatCalendarDate(refund.transactionDate)}
                  </span>
                  <span className="block truncate text-muted-foreground text-sm">
                    {refund.wallet.name}
                    {refund.wallet.archived && " (Archived)"}
                  </span>
                </span>
                <Money
                  amount={refund.amount}
                  sign="+"
                  className="shrink-0 text-base"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListSection>
  );
}
