import type { components } from "@/core/api/openapi.gen";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { groupHistoryByMonth } from "@/features/transactions/history-groups";
import { ListSection } from "@/shared/components/list-section";

type ApiTransaction = components["schemas"]["Transaction"];

interface MonthSectionsProps {
  transactions: readonly ApiTransaction[];
  /** Keeps heading ids unique when a screen holds two month lists. */
  idPrefix: string;
  /** 3 when the sections sit inside a region that already has its own h2. */
  level?: 2 | 3;
  savedId?: string;
  pageWalletId?: string;
}

/** One list section per month of the transaction date, newest first. */
export function MonthSections({
  transactions,
  idPrefix,
  level,
  savedId,
  pageWalletId,
}: Readonly<MonthSectionsProps>) {
  return (
    <>
      {groupHistoryByMonth(transactions).map((group) => (
        <ListSection
          key={group.key}
          headingId={`${idPrefix}-${group.key}-heading`}
          heading={group.label}
          level={level}
        >
          <TransactionList
            transactions={group.transactions}
            savedId={savedId}
            pageWalletId={pageWalletId}
          />
        </ListSection>
      ))}
    </>
  );
}
