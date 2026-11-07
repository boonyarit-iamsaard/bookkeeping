import type { components } from "@/core/api/openapi.gen";
import {
  splitWalletBalance,
  totalWalletBalance,
} from "@/features/wallets/wallet-total";
import { DisplayFigure } from "@/shared/components/display-figure";
import { Money } from "@/shared/components/money";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletsTotalProps {
  wallets: readonly WalletSummary[];
  lead: "spendable" | "total";
  /** The Caption beneath, saying what the figure covers. */
  caption: string;
}

/** Current holdings across every wallet, with Savings separated when present. */
export function WalletsTotal({
  wallets,
  lead,
  caption,
}: Readonly<WalletsTotalProps>) {
  const split = splitWalletBalance(wallets);
  if (!split) {
    return (
      <DisplayFigure
        amount={totalWalletBalance(wallets)}
        heading="Total balance"
        headingId="total-balance-heading"
        caption={caption}
      />
    );
  }

  const leadsWithSpendable = lead === "spendable";
  const secondaryBalances = leadsWithSpendable
    ? [
        { label: "Set aside", amount: split.setAside },
        { label: "Total balance", amount: split.total },
      ]
    : [
        { label: "Spendable", amount: split.spendable },
        { label: "Set aside", amount: split.setAside },
      ];

  return (
    <DisplayFigure
      amount={leadsWithSpendable ? split.spendable : split.total}
      heading={leadsWithSpendable ? "Spendable" : "Total balance"}
      headingId={
        leadsWithSpendable ? "spendable-heading" : "total-balance-heading"
      }
      caption={caption}
    >
      <dl className="mt-5 space-y-2">
        {secondaryBalances.map(({ label, amount }) => (
          <div
            key={label}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <dt className="text-hero-muted text-sm">{label}</dt>
            <dd className="ml-auto max-w-full min-w-0 wrap-anywhere">
              <Money
                amount={amount}
                className="text-base leading-snug font-[650] tracking-[-0.012em]"
              />
            </dd>
          </div>
        ))}
      </dl>
    </DisplayFigure>
  );
}
