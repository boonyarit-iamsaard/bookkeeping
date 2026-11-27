import type { ReactNode } from "react";
import type { components } from "@/core/api/openapi.gen";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { ErrorNotice } from "@/shared/components/error-notice";

type ApiTransaction = components["schemas"]["Transaction"];

interface TransactionHistoryProps {
  transactions: readonly ApiTransaction[];
  /** Why the address's filters are invalid; empty when the history can show. */
  filterErrors: readonly string[];
  filtered: boolean;
  /** The composition's rows, shown once there are transactions to list. */
  children: ReactNode;
}

/** Why the address's filters are invalid, one message each. */
export function FilterErrorNotice({
  errors,
}: Readonly<{ errors: readonly string[] }>) {
  return (
    <ErrorNotice>
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </ErrorNotice>
  );
}

export function TransactionHistory({
  transactions,
  filterErrors,
  filtered,
  children,
}: Readonly<TransactionHistoryProps>) {
  if (filterErrors.length > 0) {
    return <FilterErrorNotice errors={filterErrors} />;
  }

  if (filtered && transactions.length === 0) {
    return (
      <section
        className="bg-card shadow-card flex flex-col gap-1.5 rounded-2xl p-5 sm:p-7"
        aria-labelledby="no-matches-heading"
      >
        <h2
          id="no-matches-heading"
          className="text-lg font-bold tracking-tight"
        >
          No matching transactions
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-normal">
          Try a wider date range or clear the filters to see all your history.
        </p>
      </section>
    );
  }

  if (transactions.length === 0) {
    return <TransactionList transactions={transactions} />;
  }

  return children;
}
