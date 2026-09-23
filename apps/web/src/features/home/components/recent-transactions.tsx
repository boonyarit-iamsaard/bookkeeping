import { Link } from "@tanstack/react-router";
import type { components } from "@/core/api/openapi.gen";
import { TransactionList } from "@/features/transactions/components/transaction-list";

type ApiTransaction = components["schemas"]["Transaction"];

interface RecentTransactionsProps {
  transactions: readonly ApiTransaction[];
  savedId?: string;
}

/** The latest entries in history's own rows, so a new one can be confirmed. */
export function RecentTransactions({
  transactions,
  savedId,
}: Readonly<RecentTransactionsProps>) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <h2 id="recent-heading" className="font-semibold text-lg">
        Recent transactions
      </h2>
      {transactions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No transactions yet</p>
      ) : (
        <>
          <TransactionList transactions={transactions} savedId={savedId} />
          <Link
            to="/transactions"
            className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm font-medium text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            All transactions <span aria-hidden="true">→</span>
          </Link>
        </>
      )}
    </section>
  );
}
