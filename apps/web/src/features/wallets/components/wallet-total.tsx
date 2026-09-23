import type { components } from "@/core/api/openapi.gen";
import { totalWalletBalance } from "@/features/wallets/wallet-total";
import { DisplayFigure } from "@/shared/components/display-figure";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletsTotalProps {
  wallets: readonly WalletSummary[];
  /** The Caption beneath, saying what the figure covers. */
  caption: string;
}

/** The one display figure: the balance across every wallet, archived included. */
export function WalletsTotal({
  wallets,
  caption,
}: Readonly<WalletsTotalProps>) {
  return (
    <DisplayFigure
      amount={totalWalletBalance(wallets)}
      heading="Total balance"
      headingId="total-balance-heading"
      caption={caption}
    />
  );
}
