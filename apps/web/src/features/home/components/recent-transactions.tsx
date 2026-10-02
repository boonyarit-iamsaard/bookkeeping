import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import {
  ListSection,
  sectionLinkClass,
} from "@/shared/components/list-section";

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
    <ListSection
      headingId="recent-heading"
      heading="Recent transactions"
      action={
        transactions.length > 0 && (
          <Link to="/transactions" className={sectionLinkClass}>
            All transactions
            <ArrowRight
              aria-hidden="true"
              strokeWidth={2}
              className="size-3.5"
            />
          </Link>
        )
      }
    >
      {transactions.length === 0 ? (
        <p className="rounded-2xl bg-card px-5 py-6 text-muted-foreground text-sm shadow-card">
          No transactions yet
        </p>
      ) : (
        <TransactionList transactions={transactions} savedId={savedId} />
      )}
    </ListSection>
  );
}
