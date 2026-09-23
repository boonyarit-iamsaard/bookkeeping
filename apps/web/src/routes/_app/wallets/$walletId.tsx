// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { WalletManagement } from "@/features/wallets/components/wallet-management";

export const Route = createFileRoute("/_app/wallets/$walletId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(walletQueries.detail(params.walletId)),
  staticData: { form: true },
  component: WalletDetailPage,
});

function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  if (!wallet) {
    throw new Error("The wallet query returned no data");
  }

  return (
    <Page layout="narrow">
      <TitleBar
        title={wallet.name}
        back={<BackLink to="/wallets" aria-label="Back to Wallets" />}
      />
      <WalletManagement wallet={wallet} />
    </Page>
  );
}
