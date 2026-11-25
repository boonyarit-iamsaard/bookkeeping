// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { walletQueries } from "@/core/api/queries";
import { WalletManagementDesktop } from "@/features/wallets/screens/wallet-management.desktop";
import { WalletManagementPhone } from "@/features/wallets/screens/wallet-management.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function ManageWalletPage() {
  const { walletId } = Route.useParams();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  return useIsDesktop() ? (
    <WalletManagementDesktop wallet={wallet} />
  ) : (
    <WalletManagementPhone wallet={wallet} />
  );
}

export const Route = createFileRoute("/_app/wallets/$walletId_/manage")({
  head: () => ({ meta: [{ title: "Manage wallet" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(walletQueries.detail(params.walletId)),
  staticData: { form: true },
  component: ManageWalletPage,
});
