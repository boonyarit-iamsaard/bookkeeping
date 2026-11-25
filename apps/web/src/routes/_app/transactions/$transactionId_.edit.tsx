// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { carriesOwnTags } from "@bookkeeping/domain/transactions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import type { TransactionEntry } from "@/features/transactions/components/transaction-entry-content";
import { loadOwnedTransaction } from "@/features/transactions/owned-transaction";
import {
  TransactionEntryDesktop,
  TransactionEntryDesktopLoading,
} from "@/features/transactions/screens/transaction-entry.desktop";
import {
  TransactionEntryPhone,
  TransactionEntryPhoneLoading,
} from "@/features/transactions/screens/transaction-entry.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function EditTransactionPage() {
  const { transactionId } = Route.useParams();
  const desktop = useIsDesktop();
  const { data: transaction } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  const entry = {
    kind: "correct",
    transactionId: transaction.id,
    transactionType: transaction.type,
  } satisfies TransactionEntry;
  return desktop ? (
    <TransactionEntryDesktop entry={entry} />
  ) : (
    <TransactionEntryPhone entry={entry} />
  );
}

function EditTransactionLoading() {
  return useIsDesktop() ? (
    <TransactionEntryDesktopLoading title="Edit transaction" fixedType />
  ) : (
    <TransactionEntryPhoneLoading title="Edit transaction" />
  );
}

export const Route = createFileRoute("/_app/transactions/$transactionId_/edit")(
  {
    head: () => ({ meta: [{ title: "Edit transaction" }] }),
    loader: async ({ context, params }) => {
      const transaction = await loadOwnedTransaction(
        context.queryClient,
        params.transactionId,
      );

      // A refund shows its expense; an expense shows what it has refunded.
      const refundedExpenseId = transaction.refundOf?.id ?? transaction.id;
      await Promise.all([
        context.queryClient.ensureQueryData(walletQueries.list()),
        context.queryClient.ensureQueryData(categoryQueries.list()),
        carriesOwnTags(transaction)
          ? context.queryClient.ensureQueryData(tagQueries.list())
          : undefined,
        transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.detail(refundedExpenseId),
            )
          : undefined,
        transaction.refundOf
          ? context.queryClient.ensureQueryData(
              transactionQueries.refunds(refundedExpenseId, {
                excluding: transaction.id,
              }),
            )
          : undefined,
        transaction.type === "expense"
          ? context.queryClient.ensureQueryData(
              transactionQueries.refunds(transaction.id),
            )
          : undefined,
      ]);
    },
    staticData: { form: true },
    pendingComponent: EditTransactionLoading,
    errorComponent: HistoryErrorBoundary,
    component: EditTransactionPage,
  },
);
