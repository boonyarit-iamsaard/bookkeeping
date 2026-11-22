import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { CreateWalletForm } from "@/features/wallets/components/create-wallet-form";
import { WalletList } from "@/features/wallets/components/wallet-list";
import { WalletsLoading } from "@/features/wallets/components/wallets-loading";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

interface WalletsSearch {
  created?: string;
}

function WalletsPage() {
  const { data } = useSuspenseQuery(walletQueries.list());
  const { created } = Route.useSearch();
  // From 1024px New wallet opens over this list.
  const newWallet = useEntryDialog();
  const openNewWallet = useIsDesktop() ? () => newWallet.open() : null;

  return (
    <Page layout="dashboard">
      <TitleBar
        title="Wallets"
        actions={
          data.items.length > 0 && (
            <Link
              to="/wallets/new"
              onClick={openInPlace(openNewWallet)}
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
        onCreateWallet={openNewWallet}
      />
      {newWallet.saved && (
        <EntrySavedNotice>
          <span className="font-semibold">Wallet created.</span> The list
          includes it.
        </EntrySavedNotice>
      )}
      <EntryDialog
        {...newWallet.dialog}
        title="New wallet"
        loadError="This form could not load. Try again; nothing has been saved."
      >
        <CreateWalletForm host={newWallet.host} />
      </EntryDialog>
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
