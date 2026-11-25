import type { components } from "@/core/api/openapi.gen";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { NewWalletLink } from "@/features/wallets/components/new-wallet-link";
import { WalletList } from "@/features/wallets/components/wallet-list";

import { HeroSkeleton, Skeleton } from "@/shared/components/skeleton";

interface WalletsPhoneProps {
  collection: components["schemas"]["WalletCollection"];
  createdId: string | undefined;
}

/** New wallet navigates to its own page. */
export function WalletsPhone({
  collection,
  createdId,
}: Readonly<WalletsPhoneProps>) {
  return (
    <Page layout="wide">
      <TitleBar
        title="Wallets"
        actions={collection.items.length > 0 && <NewWalletLink />}
      />
      <WalletList
        wallets={collection.items}
        balance={collection.balance}
        createdId={createdId}
      />
    </Page>
  );
}

export function WalletsPhoneLoading() {
  return (
    <Page layout="wide" loading>
      <TitleBar title="Wallets" />
      <output className="sr-only">Loading your records…</output>
      <div aria-hidden="true" className="contents">
        <HeroSkeleton />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {["first", "second", "third"].map((card) => (
            <div
              key={card}
              className="bg-card shadow-card flex min-h-28 gap-3.5 rounded-2xl p-4 sm:p-5"
            >
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
                <Skeleton className="mt-auto h-5 w-28 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
