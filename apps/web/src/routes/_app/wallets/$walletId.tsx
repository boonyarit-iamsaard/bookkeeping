// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { historySearchSchema } from "@/features/transactions/history-schema";
import { WalletPageErrorBoundary } from "@/features/wallets/components/wallet-page-error-boundary";
import {
  WalletDesktop,
  WalletDesktopLoading,
} from "@/features/wallets/screens/wallet.desktop";
import {
  WalletPhone,
  WalletPhoneLoading,
} from "@/features/wallets/screens/wallet.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

/** One wallet's history: the list's own address, pinned to this wallet. */
function walletHistoryQuery(walletId: string, cursor: string | undefined) {
  return transactionQueries.list({ walletId, cursor });
}

function WalletPage() {
  const { walletId } = Route.useParams();
  const { cursor, created } = Route.useSearch();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  const { data: page } = useSuspenseQuery(walletHistoryQuery(walletId, cursor));
  return useIsDesktop() ? (
    <WalletDesktop wallet={wallet} page={page} createdId={created} />
  ) : (
    <WalletPhone wallet={wallet} page={page} createdId={created} />
  );
}

function WalletPageLoading() {
  return useIsDesktop() ? <WalletDesktopLoading /> : <WalletPhoneLoading />;
}

export const Route = createFileRoute("/_app/wallets/$walletId")({
  validateSearch: historySearchSchema.pick({ cursor: true, created: true }),
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ context, params, deps }) => {
    const [wallet] = await Promise.all([
      context.queryClient.ensureQueryData(
        walletQueries.detail(params.walletId),
      ),
      context.queryClient.ensureQueryData(
        walletHistoryQuery(params.walletId, deps.cursor),
      ),
      // Rows take their category color from this read.
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
    return { walletName: wallet.name };
  },
  // After the loader, so its data is typed here.
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.walletName ?? "Wallet" }],
  }),
  pendingComponent: WalletPageLoading,
  errorComponent: WalletPageErrorBoundary,
  component: WalletPage,
});
