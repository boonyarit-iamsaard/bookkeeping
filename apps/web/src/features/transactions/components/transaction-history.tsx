import type { components } from "@/core/api/openapi.gen";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { ErrorNotice } from "@/shared/components/error-notice";

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
      <ErrorNotice>
        {filterErrors.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </ErrorNotice>
    );
  }

  if (filtered && transactions.length === 0) {
    return (
      <section
        className="flex flex-col gap-1.5 rounded-2xl bg-card p-5 shadow-card sm:p-7"
        aria-labelledby="no-matches-heading"
      >
        <h2
          id="no-matches-heading"
          className="font-bold text-lg tracking-tight"
        >
          No matching transactions
        </h2>
        <p className="max-w-prose text-muted-foreground text-sm leading-normal">
          Try a wider date range or clear the filters to see all your history.
        </p>
      </section>
    );
  }

  if (transactions.length === 0) {
    return <TransactionList transactions={transactions} />;
  }

  return (
    <MonthSections
      transactions={transactions}
      idPrefix="history"
      savedId={savedId}
    />
  );
}
