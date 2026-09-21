// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { walletQueries } from "@/core/api/queries";
import { WalletManagement } from "@/features/wallets/components/wallet-management";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/wallets/$walletId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(walletQueries.detail(params.walletId)),
  component: WalletDetailPage,
});

function WalletDetailPage() {
  const { walletId } = Route.useParams();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  if (!wallet) {
    throw new Error("The wallet query returned no data");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="wrap-break-word min-w-0 font-semibold text-2xl">
          {wallet.name}
        </h1>
        <Link to="/wallets" className={buttonVariants({ variant: "ghost" })}>
          Back
        </Link>
      </div>
      <WalletManagement wallet={wallet} />
    </main>
  );
}
