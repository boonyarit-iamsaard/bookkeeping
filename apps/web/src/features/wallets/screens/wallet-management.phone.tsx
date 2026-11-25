import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { WalletManagement } from "@/features/wallets/components/wallet-management";

interface WalletManagementPhoneProps {
  wallet: components["schemas"]["Wallet"];
}

/** Below 1024px the title bar truncates, so the name repeats in full. */
export function WalletManagementPhone({
  wallet,
}: Readonly<WalletManagementPhoneProps>) {
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
      <WalletManagement
        wallet={wallet}
        nameLine={
          <p className="text-sm font-medium wrap-break-word">{wallet.name}</p>
        }
      />
    </Page>
  );
}
