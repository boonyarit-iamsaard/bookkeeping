import type { components } from "@/core/api/openapi.gen";
import { walletCaption } from "@/features/wallets/wallet-labels";
import { walletMorphName } from "@/features/wallets/wallet-morph";
import { DisplayFigure } from "@/shared/components/display-figure";

type Wallet = components["schemas"]["Wallet"];

interface WalletBalanceProps {
  wallet: Readonly<Wallet>;
}

/** A wallet page's one display figure: what the wallet holds now. */
export function WalletBalance({ wallet }: Readonly<WalletBalanceProps>) {
  return (
    <DisplayFigure
      amount={wallet.balance}
      heading="Current balance"
      headingId="wallet-balance-heading"
      caption={walletCaption(wallet)}
      morphName={walletMorphName(wallet.id)}
    />
  );
}
