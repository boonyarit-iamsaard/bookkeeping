// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { olderHistoryPage } from "@/features/transactions/history-pages";
import { historySearchSchema } from "@/features/transactions/history-schema";
import {
  historyReadSearch,
  walletHistoryList,
} from "@/features/transactions/history-view";
import { WalletPageErrorBoundary } from "@/features/wallets/components/wallet-page-error-boundary";
import {
  WalletDesktop,
  WalletDesktopLoading,
} from "@/features/wallets/screens/wallet.desktop";
import {
  WalletPhone,
  WalletPhoneLoading,
} from "@/features/wallets/screens/wallet.phone";
import { isDesktopViewport, useIsDesktop } from "@/shared/hooks/use-is-desktop";

function WalletPage() {
  const { walletId } = Route.useParams();
  const desktop = useIsDesktop();
  const search = Route.useSearch();
  const readSearch = historyReadSearch(search, { desktop });
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  const { data: page } = useSuspenseQuery(
    transactionQueries.list(walletHistoryList(walletId, readSearch)),
  );
  const screen = {
    wallet,
    page,
    search,
    createdId: search.created,
    olderPage: olderHistoryPage(readSearch, page.page.total),
  };
  return desktop ? <WalletDesktop {...screen} /> : <WalletPhone {...screen} />;
}

function WalletPageLoading() {
  return useIsDesktop() ? <WalletDesktopLoading /> : <WalletPhoneLoading />;
}

export const Route = createFileRoute("/_app/wallets/$walletId")({
  validateSearch: historySearchSchema.pick({
    page: true,
    pageSize: true,
    sort: true,
    order: true,
    created: true,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, params, deps }) => {
    const [wallet] = await Promise.all([
      context.queryClient.ensureQueryData(
        walletQueries.detail(params.walletId),
      ),
      context.queryClient.ensureQueryData(
        transactionQueries.list(
          walletHistoryList(
            params.walletId,
            historyReadSearch(deps.search, { desktop: isDesktopViewport() }),
          ),
        ),
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
