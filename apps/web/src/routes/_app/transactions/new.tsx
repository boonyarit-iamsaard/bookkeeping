import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  categoryQueries,
  tagQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { isSignedInPathname } from "@/core/router/router";
import {
  captureSearchSchema,
  parseCaptureOrigin,
} from "@/features/transactions/capture-origin";
import type { TransactionEntry } from "@/features/transactions/components/transaction-entry-content";
import {
  TransactionEntryDesktop,
  TransactionEntryDesktopLoading,
} from "@/features/transactions/screens/transaction-entry.desktop";
import {
  TransactionEntryPhone,
  TransactionEntryPhoneLoading,
} from "@/features/transactions/screens/transaction-entry.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function NewTransactionPage() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const search = Route.useSearch();
  const captureOrigin = parseCaptureOrigin(search.origin, (pathname) =>
    isSignedInPathname(router, pathname),
  );
  const entry = {
    kind: "record",
    captureOrigin,
    requestedWalletId: search.wallet,
  } satisfies TransactionEntry;
  return desktop ? (
    <TransactionEntryDesktop entry={entry} />
  ) : (
    <TransactionEntryPhone entry={entry} />
  );
}

function NewTransactionLoading() {
  return useIsDesktop() ? (
    <TransactionEntryDesktopLoading title="New transaction" />
  ) : (
    <TransactionEntryPhoneLoading title="New transaction" />
  );
}

export const Route = createFileRoute("/_app/transactions/new")({
  head: () => ({ meta: [{ title: "New transaction" }] }),
  validateSearch: captureSearchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(tagQueries.list()),
      context.queryClient.ensureQueryData(transactionQueries.entryDefaults()),
    ]);
  },
  pendingComponent: NewTransactionLoading,
  staticData: { form: true },
  component: NewTransactionPage,
});
