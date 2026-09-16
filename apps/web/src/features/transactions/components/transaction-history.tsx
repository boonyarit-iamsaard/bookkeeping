import type { TransactionDetail } from "@bookkeeping/domain/transactions";
import { TransactionList } from "@/features/transactions/components/transaction-list";

interface TransactionHistoryProps {
  transactions: readonly TransactionDetail[];
  filtersValid: boolean;
  filtered: boolean;
  savedId?: string;
}

export function TransactionHistory({
  transactions,
  filtersValid,
  filtered,
  savedId,
}: Readonly<TransactionHistoryProps>) {
  if (!filtersValid) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Choose valid filters. From date must be on or before To date.
      </p>
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
