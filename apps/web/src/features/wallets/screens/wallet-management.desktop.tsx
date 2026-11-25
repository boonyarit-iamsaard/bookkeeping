import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { WalletManagement } from "@/features/wallets/components/wallet-management";

interface WalletManagementDesktopProps {
  wallet: components["schemas"]["Wallet"];
}

/** From 1024px the title bar shows the whole name. */
export function WalletManagementDesktop({
  wallet,
}: Readonly<WalletManagementDesktopProps>) {
  return (
    <Page layout="column">
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
