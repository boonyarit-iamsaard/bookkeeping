import type { components } from "@/core/api/openapi.gen";
import { BackLink } from "@/core/shell/title-bar";
import { walletCaption } from "@/features/wallets/wallet-labels";
import { Money } from "@/shared/components/money";

type Wallet = components["schemas"]["Wallet"];

interface WalletDesktopHeaderProps {
  wallet: Readonly<Wallet>;
  /** The Manage link, shared with the phone's title bar. */
  manage: React.ReactNode;
}

/**
 * A wallet page's head from 1024px: back, name and Manage on the left, what
 * the wallet holds now as a plain figure on the right, not a card.
 */
export function WalletDesktopHeader({
  wallet,
  manage,
}: Readonly<WalletDesktopHeaderProps>) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex min-w-0 items-center gap-2">
        <BackLink to="/wallets" aria-label="Back to Wallets" />
        <h1 className="min-w-0 text-3xl leading-tight font-bold tracking-[-0.02em] wrap-break-word">
          {wallet.name}
        </h1>
        <div className="ml-2 shrink-0">{manage}</div>
      </div>
      <section
        aria-labelledby="wallet-balance-heading"
        className="shrink-0 text-right"
      >
        <h2
          id="wallet-balance-heading"
          className="text-muted-foreground text-sm font-medium"
        >
          Current balance
        </h2>
        <p className="text-4xl leading-tight font-bold tracking-[-0.025em]">
          <Money amount={wallet.balance} display className="font-bold" />
        </p>
        <p className="text-muted-foreground text-sm">{walletCaption(wallet)}</p>
      </section>
    </div>
  );
}
