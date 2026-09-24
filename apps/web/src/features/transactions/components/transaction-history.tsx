import type { components } from "@/core/api/openapi.gen";
import { TransactionList } from "@/features/transactions/components/transaction-list";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionHistoryProps {
  transactions: readonly ApiTransaction[];
  /** Why the address's filters are invalid; empty when the history can show. */
  filterErrors: readonly string[];
  filtered: boolean;
  savedId?: string;
}

export function TransactionHistory({
  transactions,
  filterErrors,
  filtered,
  savedId,
}: Readonly<TransactionHistoryProps>) {
  if (filterErrors.length > 0) {
    return (
      <div role="alert" className="text-destructive text-sm">
        {filterErrors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </div>
    );
  }

  if (filtered && transactions.length === 0) {
    return (
      <section
        className="flex flex-col gap-2"
        aria-labelledby="no-matches-heading"
      >
        <h2 id="no-matches-heading" className="font-semibold text-lg">
          No matching transactions
        </h2>
        <p className="text-muted-foreground text-sm">
          Try a wider date range or clear the filters to see all your history.
        </p>
      </section>
    );
  }

  return <TransactionList transactions={transactions} savedId={savedId} />;
}
