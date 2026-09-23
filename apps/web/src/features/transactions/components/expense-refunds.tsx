import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { Link } from "@tanstack/react-router";
import { Undo2 } from "lucide-react";
import { parseApiMoney } from "@/core/api/api-money";
import type { components } from "@/core/api/openapi.gen";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";

type ApiTransactionRefunds = components["schemas"]["TransactionRefunds"];

interface ExpenseRefundsViewProps {
  expense: Pick<components["schemas"]["Transaction"], "id">;
  refunds: ApiTransactionRefunds;
}

/** Shows linked refunds and the allowance returned by the API for an expense. */
export function ExpenseRefundsView({
  expense,
  refunds,
}: Readonly<ExpenseRefundsViewProps>) {
  const canRecordRefund = parseApiMoney(refunds.remaining) > 0n;
  return (
    <section
      aria-labelledby="expense-refunds-heading"
      className="flex flex-col gap-4 border-t pt-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="expense-refunds-heading" className="font-semibold text-lg">
            Refunds
          </h2>
          <p className="text-muted-foreground text-sm">
            {refunds.refunds.length === 0 ? (
              "None recorded. A refund returns part or all of this expense."
            ) : (
              <>
                <Money amount={refunds.refundedTotal} /> refunded ·{" "}
                <Money amount={refunds.remaining} /> left
              </>
            )}
          </p>
        </div>
        {canRecordRefund ? (
          <Link
            to="/transactions/$transactionId/refund"
            params={{ transactionId: expense.id }}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <Undo2 data-icon="inline-start" strokeWidth={1.75} />
            Record refund
          </Link>
        ) : (
          <p className="font-medium text-sm">Fully refunded</p>
        )}
      </div>
      {refunds.refunds.length > 0 && (
        <ul className="-mx-4 divide-y sm:mx-0" aria-label="Linked refunds">
          {refunds.refunds.map((refund) => (
            <li key={refund.id}>
              <Link
                to="/transactions/$transactionId"
                params={{ transactionId: refund.id }}
                className="flex min-h-14 items-center gap-4 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {formatCalendarDate(refund.transactionDate)}
                  </span>
                  <span className="block truncate text-muted-foreground text-sm">
                    {refund.wallet.name}
                    {refund.wallet.archived && " (Archived)"}
                  </span>
                </span>
                <span className="money shrink-0" translate="no">
                  +
                  {formatMoney({
                    amountInMinorUnits: parseApiMoney(refund.amount),
                    currency: refund.amount.currency,
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
