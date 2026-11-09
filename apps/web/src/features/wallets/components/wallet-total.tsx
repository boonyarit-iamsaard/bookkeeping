import type { components } from "@/core/api/openapi.gen";
import { walletCountLabel } from "@/features/wallets/wallet-labels";
import { DisplayFigure } from "@/shared/components/display-figure";
import { Money } from "@/shared/components/money";

type WalletBalance = components["schemas"]["WalletBalance"];
type WalletBalanceName = "total" | "spendable" | "setAside";

interface WalletsTotalProps {
  balance: Readonly<WalletBalance>;
  lead: "spendable" | "total";
}

interface HeroBalances {
  headingId: string;
  secondary: readonly WalletBalanceName[];
  countOf: (balance: Readonly<WalletBalance>) => number;
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
    countOf: (balance) => balance.spendableWalletCount,
  },
  total: {
    headingId: "total-balance-heading",
    secondary: ["spendable", "setAside"],
    countOf: (balance) => balance.walletCount,
  },
};

/** Current holdings across every wallet, with Set aside split out when present. */
export function WalletsTotal({ balance, lead }: Readonly<WalletsTotalProps>) {
  const split = balance.savingsWalletCount > 0;
  // Without a Spendable wallet there is no Spendable to lead with.
  const figure = split && balance.spendable !== null ? lead : "total";
  const amount = balance[figure];
  if (amount === null) {
    return null;
  }
  const { headingId, secondary, countOf } = HERO_BALANCES[figure];
  const rows = split
    ? secondary.flatMap((name) => {
        const value = balance[name];
        return value === null ? [] : [{ name, value }];
      })
    : [];

  return (
    <DisplayFigure
      amount={amount}
      heading={BALANCE_LABELS[figure]}
      headingId={headingId}
      caption={`Across ${walletCountLabel(countOf(balance))}`}
    >
      {rows.length > 0 && (
        <dl className="mt-5 space-y-2">
          {rows.map(({ name, value }) => (
            <div
              key={name}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
            >
              <dt className="text-hero-muted text-sm">
                {BALANCE_LABELS[name]}
              </dt>
              <dd className="ml-auto max-w-full min-w-0 wrap-anywhere">
                <Money
                  amount={value}
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
