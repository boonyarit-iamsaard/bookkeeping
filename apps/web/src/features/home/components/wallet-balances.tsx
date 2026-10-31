import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { WalletShareChart } from "@/shared/components/chart/wallet-share-chart";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletBalancesProps {
  wallets: readonly WalletSummary[];
}

/**
 * Where the total sits: each wallet's current balance on the shared zero
 * line. The heading is the way into the wallet list.
 */
export function WalletBalances({ wallets }: Readonly<WalletBalancesProps>) {
  const shares = wallets.map((wallet) => ({
    wallet,
    balance: wallet.balance,
  }));

  return (
    <section
      aria-labelledby="home-wallets-heading"
      className="bg-card shadow-card ease-out-expo relative flex flex-col gap-5 rounded-2xl p-5 transition-[background-color,scale] duration-150 has-[a:active]:scale-[0.98] has-[a:active]:duration-[90ms] has-[a:hover]:bg-[color-mix(in_oklch,var(--card),var(--accent)_70%)] motion-reduce:transition-none sm:p-6"
    >
      <h2
        id="home-wallets-heading"
        className="text-lg font-bold tracking-tight"
      >
        <Link
          to="/wallets"
          className="focus-visible:after:ring-ring/45 -my-2 flex min-h-11 items-center justify-between gap-2 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px]"
        >
          Wallets
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="text-muted-foreground size-5"
          />
        </Link>
      </h2>
      <WalletShareChart shares={shares} />
    </section>
  );
}
