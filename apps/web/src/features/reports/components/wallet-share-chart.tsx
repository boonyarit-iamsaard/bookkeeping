import type { ApiMoney } from "@/core/api/money";
import { parseApiMoney } from "@/core/api/money";
import type { components } from "@/core/api/openapi.gen";
import { BarTrack } from "@/shared/components/chart/bar-track";
import { Money } from "@/shared/components/money";
import { scaleBars } from "@/shared/helpers/bar-scale";

type WalletSummary = components["schemas"]["Wallet"];

export interface WalletShare {
  wallet: Readonly<WalletSummary>;
  /** The wallet's balance at the end of the chosen date. */
  balance: ApiMoney;
}

interface WalletShareChartProps {
  shares: readonly WalletShare[];
}

/**
 * The level 1 chart for wallets: each one's balance as a bar from a shared
 * zero line, so a negative wallet reaches left of it and says so in its signed
 * amount. A ring could not show that slice.
 */
export function WalletShareChart({ shares }: Readonly<WalletShareChartProps>) {
  const { zero, bars } = scaleBars(
    shares.map((share) => parseApiMoney(share.balance)),
  );

  return (
    <ul className="flex flex-col gap-4">
      {shares.map(({ wallet, balance }, index) => (
        <li key={wallet.id} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="wrap-break-word min-w-0 text-sm">
              {wallet.name}
              {wallet.archivedAt && (
                <span className="text-muted-foreground"> · Archived</span>
              )}
            </span>
            <Money amount={balance} className="shrink-0 text-sm" />
          </div>
          <BarTrack
            bar={bars[index]}
            zero={zero}
            series={parseApiMoney(balance) < 0n ? "negative" : "balance"}
          />
        </li>
      ))}
    </ul>
  );
}
