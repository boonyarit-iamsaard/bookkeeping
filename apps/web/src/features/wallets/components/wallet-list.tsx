import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { WalletTile } from "@/features/wallets/components/wallet-tile";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import {
  walletCaption,
  walletCountLabel,
} from "@/features/wallets/wallet-labels";
import { EmptyState } from "@/shared/components/empty-state";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletListProps {
  wallets: readonly WalletSummary[];
  /** The wallet just created, if any; it alone arrives with a rise. */
  createdId?: string;
}

/** A new account holder's first step: create a wallet. */
export function EmptyWallets() {
  return (
    <EmptyState
      icon={Wallet}
      headingId="empty-wallets-heading"
      title="No wallets yet"
      description="Add the cash, bank accounts, and e-wallets you want to track. Each one starts from an opening balance on the date its history begins."
      action={
        <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
          <Plus data-icon="inline-start" />
          Create your first wallet
        </Link>
      }
    />
  );
}

export function WalletList({ wallets, createdId }: Readonly<WalletListProps>) {
  if (wallets.length === 0) {
    return <EmptyWallets />;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <WalletsTotal
        wallets={wallets}
        caption={`Across ${walletCountLabel(wallets.length)}`}
      />

      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4" aria-label="Wallets">
        {wallets.map((wallet) => (
          <li
            key={wallet.id}
            data-wallet-row
            className={cn(
              "relative flex min-h-28 gap-3.5 rounded-2xl bg-card p-4 shadow-card transition-colors duration-150 has-[a:hover]:bg-[color-mix(in_oklch,var(--card),var(--accent)_70%)] motion-reduce:transition-none sm:p-5",
              wallet.id === createdId &&
                "motion-safe:fade-in motion-safe:slide-in-from-bottom-2 bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))] motion-safe:animate-in motion-safe:duration-400 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
            )}
          >
            <WalletTile
              type={wallet.type}
              archived={Boolean(wallet.archivedAt)}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              {/* The whole card opens the wallet; the link's name stays the wallet's. */}
              <Link
                to="/wallets/$walletId"
                params={{ walletId: wallet.id }}
                className="wrap-break-word pr-6 font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/45"
              >
                {wallet.name}
              </Link>
              <p className="mt-0.5 flex flex-col text-muted-foreground text-sm">
                <span>{walletCaption(wallet)}</span>
                <span>Opened {formatCalendarDate(wallet.openingDate)}</span>
              </p>
              <Money
                amount={wallet.balance}
                className="mt-auto pt-3 font-bold text-xl leading-snug"
              />
            </div>
            <ChevronRight
              aria-hidden="true"
              strokeWidth={1.75}
              className="absolute top-4 right-3 size-5 text-muted-foreground sm:top-5 sm:right-4"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
