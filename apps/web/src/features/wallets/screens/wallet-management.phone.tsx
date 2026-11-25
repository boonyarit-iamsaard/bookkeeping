import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import {
  WalletArchivePanel,
  WalletDeletionPanel,
  WalletManagementBalance,
  WalletManagementNotice,
  WalletManagementPanelSkeleton,
  WalletOpeningPanel,
  WalletSavingsPanel,
} from "@/features/wallets/components/wallet-management-panels";
import { useWalletManagement } from "@/features/wallets/hooks/use-wallet-management";

import { Skeleton } from "@/shared/components/skeleton";

interface WalletManagementPhoneProps {
  wallet: components["schemas"]["Wallet"];
}

/** Below 1024px the title bar truncates, so the name repeats in full. */
export function WalletManagementPhone({
  wallet,
}: Readonly<WalletManagementPhoneProps>) {
  const management = useWalletManagement(wallet);
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
      <WalletManagementBalance
        wallet={wallet}
        nameLine={
          <p className="text-sm font-medium wrap-break-word">{wallet.name}</p>
        }
      />
      <WalletManagementNotice management={management} />
      <WalletOpeningPanel management={management} />
      <WalletSavingsPanel management={management} savings={wallet.savings} />
      <WalletArchivePanel management={management} />
      <WalletDeletionPanel management={management} className="mt-4 sm:mt-6" />
    </Page>
  );
}

export function WalletManagementPhoneLoading() {
  return (
    <Page layout="column" loading>
      <TitleBar title={<Skeleton className="h-8 w-48" />} />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <WalletManagementPanelSkeleton className="h-5 w-28" />
        <WalletManagementPanelSkeleton className="h-52" />
        <WalletManagementPanelSkeleton className="h-24" />
        <WalletManagementPanelSkeleton className="h-24" />
        <WalletManagementPanelSkeleton className="h-24" />
      </div>
    </Page>
  );
}
