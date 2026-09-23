// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { WalletManagement } from "@/features/wallets/components/wallet-management";

export const Route = createFileRoute("/_app/wallets/$walletId_/manage")({
  head: () => ({ meta: [{ title: "Manage wallet" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(walletQueries.detail(params.walletId)),
  staticData: { form: true },
  component: ManageWalletPage,
});

function ManageWalletPage() {
  const { walletId } = Route.useParams();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  if (!wallet) {
    throw new Error("The wallet query returned no data");
  }

  return (
    <Page layout="narrow">
      <TitleBar
        title={wallet.name}
        back={
          <BackLink
            to="/wallets/$walletId"
            params={{ walletId: wallet.id }}
            aria-label={`Back to ${wallet.name}`}
          />
        }
      />
      <WalletManagement wallet={wallet} />
    </Page>
  );
}
