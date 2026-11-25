import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { NewWalletLink } from "@/features/wallets/components/new-wallet-link";
import { WalletList } from "@/features/wallets/components/wallet-list";

interface WalletsPhoneProps {
  collection: components["schemas"]["WalletCollection"];
  createdId: string | undefined;
}

/** New wallet navigates to its own page. */
export function WalletsPhone({
  collection,
  createdId,
}: Readonly<WalletsPhoneProps>) {
  return (
    <Page layout="wide">
      <TitleBar
        title="Wallets"
        actions={collection.items.length > 0 && <NewWalletLink />}
      />
      <WalletList
        wallets={collection.items}
        balance={collection.balance}
        createdId={createdId}
      />
    </Page>
  );
}
