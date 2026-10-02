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
      className="relative flex flex-col gap-5 rounded-2xl bg-card p-5 shadow-card transition-colors duration-150 has-[a:hover]:bg-[color-mix(in_oklch,var(--card),var(--accent)_70%)] motion-reduce:transition-none sm:p-6"
    >
      <h2
        id="home-wallets-heading"
        className="font-bold text-lg tracking-tight"
      >
        <Link
          to="/wallets"
          className="-my-2 flex min-h-11 items-center justify-between gap-2 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/45"
        >
          Wallets
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="size-5 text-muted-foreground"
          />
        </Link>
      </h2>
      <WalletShareChart shares={shares} />
    </section>
  );
}
