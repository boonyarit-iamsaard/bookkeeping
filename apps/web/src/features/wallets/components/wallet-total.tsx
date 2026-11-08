import type { components } from "@/core/api/openapi.gen";
import { walletCountLabel } from "@/features/wallets/wallet-labels";
import type { WalletBalanceSplit } from "@/features/wallets/wallet-total";
import {
  splitWalletBalance,
  totalWalletBalance,
} from "@/features/wallets/wallet-total";
import { DisplayFigure } from "@/shared/components/display-figure";
import { Money } from "@/shared/components/money";

type WalletSummary = components["schemas"]["Wallet"];
type WalletBalanceName = keyof WalletBalanceSplit;

interface WalletsTotalProps {
  wallets: readonly WalletSummary[];
  lead: "spendable" | "total";
}

interface HeroBalances {
  headingId: string;
  secondary: readonly WalletBalanceName[];
}

const BALANCE_LABELS: Record<WalletBalanceName, string> = {
  total: "Total balance",
  spendable: "Spendable",
  setAside: "Set aside",
};

const HERO_BALANCES: Record<WalletsTotalProps["lead"], HeroBalances> = {
  spendable: {
    headingId: "spendable-heading",
    secondary: ["setAside", "total"],
  },
  total: {
    headingId: "total-balance-heading",
    secondary: ["spendable", "setAside"],
  },
};

/** Current holdings across every wallet, with Set aside split out when present. */
export function WalletsTotal({ wallets, lead }: Readonly<WalletsTotalProps>) {
  const split = splitWalletBalance(wallets);
  const figure = split ? lead : "total";
  const { headingId, secondary } = HERO_BALANCES[figure];
  const coveredWallets =
    figure === "spendable"
      ? wallets.filter((wallet) => !wallet.savings)
      : wallets;

  return (
    <DisplayFigure
      amount={split ? split[figure] : totalWalletBalance(wallets)}
      heading={BALANCE_LABELS[figure]}
      headingId={headingId}
      caption={
        coveredWallets.length === 0
          ? "Every wallet is a Savings wallet"
          : `Across ${walletCountLabel(coveredWallets.length)}`
      }
    >
      {split && (
        <dl className="mt-5 space-y-2">
          {secondary.map((name) => (
            <div
              key={name}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <dt className="text-hero-muted text-sm">
                {BALANCE_LABELS[name]}
              </dt>
              <dd className="ml-auto max-w-full min-w-0 wrap-anywhere">
                <Money
                  amount={split[name]}
                  className="text-base leading-snug font-[650] tracking-[-0.012em]"
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </DisplayFigure>
  );
}
