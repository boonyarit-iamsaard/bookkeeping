// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  categoryQueries,
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

function RefundPage() {
  const { transactionId } = Route.useParams();
  const desktop = useIsDesktop();
  const entry = { kind: "refund", transactionId } satisfies TransactionEntry;
  return desktop ? (
    <TransactionEntryDesktop entry={entry} />
  ) : (
    <TransactionEntryPhone entry={entry} />
  );
}

function RefundLoading() {
  return useIsDesktop() ? (
    <TransactionEntryDesktopLoading title="Record refund" fixedType />
  ) : (
    <TransactionEntryPhoneLoading title="Record refund" />
  );
}

export const Route = createFileRoute(
  "/_app/transactions/$transactionId_/refund",
)({
  head: () => ({ meta: [{ title: "Record refund" }] }),
  loader: async ({ context, params }) => {
    const expense = await loadOwnedTransaction(
      context.queryClient,
      params.transactionId,
    );
    if (expense.type !== "expense") {
      throw notFound();
    }
    await Promise.all([
      context.queryClient.ensureQueryData(
        transactionQueries.refunds(params.transactionId),
      ),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
  },
  staticData: { form: true },
  pendingComponent: RefundLoading,
  errorComponent: HistoryErrorBoundary,
  component: RefundPage,
});
