import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { formatMoney } from "@bookkeeping/domain/money";
import { Undo2 } from "lucide-react";
import Link from "next/link";
import type {
  ExpenseRefunds,
  TransactionDetail,
} from "@/features/transactions/transaction.types";
import { buttonVariants } from "@/shared/components/ui/button";

interface ExpenseRefundsViewProps {
  expense: Pick<TransactionDetail, "id" | "currency">;
  refunds: ExpenseRefunds;
}

/**
 * The refunds linked to an expense, what they add up to, and the way to
 * record another while anything is left. Deletion of the expense is blocked
 * while any of these remain, so they are named here.
 */
export function ExpenseRefundsView({
  expense,
  refunds,
}: Readonly<ExpenseRefundsViewProps>) {
  const money = (amount: bigint) =>
    formatMoney({ amountInMinorUnits: amount, currency: expense.currency });
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
                <span className="money" translate="no">
                  {money(refunds.refundedTotal)}
                </span>{" "}
                refunded ·{" "}
                <span className="money" translate="no">
                  {money(refunds.remaining)}
                </span>{" "}
                left
              </>
            )}
          </p>
        </div>
        {refunds.remaining > 0n ? (
          <Link
            href={`/transactions/${expense.id}/refund`}
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
                href={`/transactions/${refund.id}`}
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
                  +{money(refund.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
