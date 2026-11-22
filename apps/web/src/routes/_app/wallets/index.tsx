import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { WalletList } from "@/features/wallets/components/wallet-list";
import { WalletsLoading } from "@/features/wallets/components/wallets-loading";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletsSearch {
  created?: string;
}

function WalletsPage() {
  const { data } = useSuspenseQuery(walletQueries.list());
  const { created } = Route.useSearch();

  return (
    <Page layout="dashboard">
      <TitleBar
        title="Wallets"
        actions={
          data.items.length > 0 && (
            <Link
              to="/wallets/new"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Plus data-icon="inline-start" />
              New wallet
            </Link>
          )
        }
      />
      <WalletList
        wallets={data.items}
        balance={data.balance}
        createdId={created}
      />
    </Page>
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
