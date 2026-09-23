import type { components } from "@/core/api/openapi.gen";
import { totalWalletBalance } from "@/features/wallets/wallet-total";
import { Money } from "@/shared/components/money";

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
    <section aria-labelledby="total-balance-heading">
      <h2 id="total-balance-heading" className="sr-only">
        Total balance
      </h2>
      <p className="text-4xl leading-none sm:text-5xl">
        <Money amount={totalWalletBalance(wallets)} display />
      </p>
      <p className="mt-2 text-muted-foreground text-sm">{caption}</p>
    </section>
  );
}
