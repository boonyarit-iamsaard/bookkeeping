import { formatCalendarDate } from "@bookkeeping/domain/dates";
import { Link } from "@tanstack/react-router";
import { Plus, Wallet } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import { WalletsTotal } from "@/features/wallets/components/wallet-total";
import { WalletTypeIcon } from "@/features/wallets/components/wallet-type-icon";
import {
  WALLET_TYPE_LABELS,
  walletCountLabel,
} from "@/features/wallets/wallet-labels";
import { Money } from "@/shared/components/money";
import { buttonVariants } from "@/shared/components/ui/button";
import { cn } from "@/shared/helpers/cn";

type WalletSummary = components["schemas"]["Wallet"];

interface WalletListProps {
  wallets: readonly WalletSummary[];
  /** The wallet just created, if any; it alone arrives with a fade. */
  createdId?: string;
}

export function WalletList({ wallets, createdId }: Readonly<WalletListProps>) {
  if (wallets.length === 0) {
    return <EmptyWallets />;
  }

  return (
    <div className="flex flex-col gap-8">
      <WalletsTotal
        wallets={wallets}
        caption={`Total across ${walletCountLabel(wallets.length)}`}
      />

      <ul className="-mx-4 divide-y sm:mx-0" aria-label="Wallets">
        {wallets.map((wallet) => (
          <li
            key={wallet.id}
            data-wallet-row
            className={cn(
              "flex min-h-16 items-center gap-4 px-4 py-3 sm:px-0",
              wallet.id === createdId &&
                "motion-safe:fade-in motion-safe:animate-in motion-safe:duration-500",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <WalletTypeIcon type={wallet.type} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                to="/wallets/$walletId"
                params={{ walletId: wallet.id }}
                className="flex min-h-11 items-center rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="truncate">{wallet.name}</span>
              </Link>
              {wallet.archivedAt && (
                <span className="text-muted-foreground text-sm">
                  Archived ·{" "}
                </span>
              )}
              <p className="flex flex-col text-muted-foreground text-sm sm:flex-row sm:gap-x-1.5">
                <span>{WALLET_TYPE_LABELS[wallet.type]}</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span>Opened {formatCalendarDate(wallet.openingDate)}</span>
              </p>
            </div>
            <Money amount={wallet.balance} className="shrink-0 text-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A new account holder's first step: create a wallet. */
export function EmptyWallets() {
  return (
    <section
      aria-labelledby="empty-wallets-heading"
      className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-6 sm:p-8"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Wallet aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="empty-wallets-heading" className="font-semibold text-lg">
          No wallets yet
        </h2>
        <p className="max-w-prose text-muted-foreground text-sm leading-normal">
          Add the cash, bank accounts, and e-wallets you want to track. Each one
          starts from an opening balance on the date its history begins.
        </p>
      </div>
      <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
        <Plus data-icon="inline-start" />
        Create your first wallet
      </Link>
    </section>
  );
}
