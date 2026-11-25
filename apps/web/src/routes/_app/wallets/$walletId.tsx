// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { olderHistoryPage } from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { historySearchSchema } from "@/features/transactions/history-schema";
import { DEFAULT_HISTORY_PAGE_SIZE } from "@/features/transactions/history-view";
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

type WalletSearch = Pick<
  HistorySearch,
  "created" | "order" | "page" | "pageSize" | "sort"
>;

/** One wallet's history: the list's own address, pinned to this wallet. */
function walletHistoryQuery(
  walletId: string,
  { page = 1, pageSize = DEFAULT_HISTORY_PAGE_SIZE, sort, order }: WalletSearch,
) {
  // The size is sent so the Older link counts pages the way the server does.
  return transactionQueries.list({
    walletId,
    page: String(page),
    pageSize: `${pageSize}`,
    ...(sort && { sort }),
    ...(order && { order }),
  });
}

function WalletPage() {
  const { walletId } = Route.useParams();
  const desktop = useIsDesktop();
  const { page: pageNumber, created, ...table } = Route.useSearch();
  // Phone keeps the default size and order; its Older link carries only the page.
  const search = {
    page: pageNumber,
    created,
    ...(desktop && table),
  };
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  const { data: page } = useSuspenseQuery(walletHistoryQuery(walletId, search));
  const screen = {
    wallet,
    page,
    search,
    createdId: search.created,
    olderPage: olderHistoryPage(search, page.page.total),
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
        walletHistoryQuery(params.walletId, deps.search),
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
