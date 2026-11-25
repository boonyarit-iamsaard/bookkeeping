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

interface WalletManagementDesktopProps {
  wallet: components["schemas"]["Wallet"];
}

const MANAGEMENT_GRID =
  "grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-8";

/** The opening correction has its own column beside wallet settings. */
export function WalletManagementDesktop({
  wallet,
}: Readonly<WalletManagementDesktopProps>) {
  const management = useWalletManagement(wallet);
  return (
    <Page layout="wide">
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
      <WalletManagementBalance wallet={wallet} />
      <WalletManagementNotice management={management} />
      <div className={MANAGEMENT_GRID}>
        <WalletOpeningPanel management={management} />
        <div className="flex min-w-0 flex-col gap-8">
          <WalletSavingsPanel
            management={management}
            savings={wallet.savings}
          />
          <WalletArchivePanel management={management} />
        </div>
      </div>
      <WalletDeletionPanel management={management} className="mt-6" />
    </Page>
  );
}

export function WalletManagementDesktopLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title={<Skeleton className="h-8 w-48" />} />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <WalletManagementPanelSkeleton className="h-5 w-28" />
        <div className={MANAGEMENT_GRID}>
          <WalletManagementPanelSkeleton className="h-52" />
          <div className="flex flex-col gap-8">
            <WalletManagementPanelSkeleton className="h-24" />
            <WalletManagementPanelSkeleton className="h-24" />
          </div>
        </div>
        <WalletManagementPanelSkeleton className="h-24" />
      </div>
    </Page>
  );
}
