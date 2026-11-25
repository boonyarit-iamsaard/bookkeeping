import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { walletQueries } from "@/core/api/queries";
import { WalletsLoading } from "@/features/wallets/components/wallets-loading";
import { WalletsDesktop } from "@/features/wallets/screens/wallets.desktop";
import { WalletsPhone } from "@/features/wallets/screens/wallets.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

interface WalletsSearch {
  created?: string;
}

function WalletsPage() {
  const { data } = useSuspenseQuery(walletQueries.list());
  const { created } = Route.useSearch();
  return useIsDesktop() ? (
    <WalletsDesktop collection={data} />
  ) : (
    <WalletsPhone collection={data} createdId={created} />
  );
}

export const Route = createFileRoute("/_app/wallets/")({
  head: () => ({ meta: [{ title: "Wallets" }] }),
  validateSearch: (search): WalletsSearch => ({
    created: typeof search.created === "string" ? search.created : undefined,
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(walletQueries.list()),
  pendingComponent: WalletsLoading,
  component: WalletsPage,
});
