import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { CreateWalletForm } from "@/features/wallets/components/create-wallet-form";
import { NewWalletLink } from "@/features/wallets/components/new-wallet-link";
import { EmptyWallets } from "@/features/wallets/components/wallet-list";
import { WalletTable } from "@/features/wallets/components/wallet-table";
import { TableCard } from "@/shared/components/dashboard-card";
import {
  EntryDialog,
  EntrySavedNotice,
  useEntryDialog,
} from "@/shared/components/form/entry-dialog";

interface WalletsDesktopProps {
  collection: components["schemas"]["WalletCollection"];
}

/** One table whose footer carries the total; New wallet opens in a dialog. */
export function WalletsDesktop({ collection }: Readonly<WalletsDesktopProps>) {
  const newWallet = useEntryDialog();
  function openNewWallet() {
    newWallet.open();
  }

  return (
    <Page layout="wide">
      <TitleBar
        title="Wallets"
        actions={
          collection.items.length > 0 && (
            <NewWalletLink onOpen={openNewWallet} />
          )
        }
      />
      {collection.items.length === 0 ? (
        <div className="max-w-2xl">
          <EmptyWallets onCreateWallet={openNewWallet} />
        </div>
      ) : (
        <TableCard>
          <WalletTable
            wallets={collection.items}
            total={collection.balance.total}
            captionArchived
          />
        </TableCard>
      )}
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
