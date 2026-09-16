import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/category";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { lastUsedWalletId } from "@/features/transactions/server/transaction";
import { listWallets } from "@/features/wallets/server/wallet";
import { buttonVariants } from "@/shared/components/ui/button";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";
import { formatMoney } from "@/shared/helpers/money";

export const metadata: Metadata = {
  title: "New transaction",
};

export default async function Page() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const ownerId = session.user.id;

  await initializeDefaultCategories(db, ownerId);
  const [allWallets, categories, lastUsed] = await Promise.all([
    listWallets(db, { ownerId: ownerId }),
    listCategories(db, ownerId),
    lastUsedWalletId(db, ownerId),
  ]);
  const wallets = allWallets.filter((wallet) => !wallet.archivedAt);
  // Last-used wallet first; otherwise the first wallet in picker order.
  const defaultWalletId =
    wallets.find((w) => w.id === lastUsed)?.id ?? wallets[0]?.id;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">
          New transaction
        </h1>
        <Link
          href="/transactions"
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      {defaultWalletId ? (
        <TransactionForm
          wallets={wallets.map((wallet) => ({
            id: wallet.id,
            name: wallet.name,
            type: wallet.type,
            openingDate: wallet.openingDate,
            balanceLabel: formatMoney({
              amountInMinorUnits: wallet.balance,
              currency: wallet.currency,
            }),
          }))}
          categories={categories}
          today={todayIn({ timeZone: APP_TIME_ZONE })}
          mode={{ kind: "create", defaultWalletId }}
        />
      ) : (
        <NoWallet />
      )}
    </main>
  );
}

function NoWallet() {
  return (
    <section
      aria-labelledby="no-wallet-heading"
      className="flex flex-col items-start gap-4 rounded-xl border border-dashed p-6 sm:p-8"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Wallet aria-hidden="true" strokeWidth={1.75} className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="no-wallet-heading" className="font-semibold text-lg">
          No active wallets
        </h2>
        <p className="max-w-prose text-muted-foreground text-sm leading-normal">
          Every transaction belongs to a wallet. Add the cash, bank account, or
          e-wallet the money moved through, then come back to record it.
        </p>
      </div>
      <Link
        href="/wallets"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Create or unarchive a wallet
      </Link>
      <Link href="/wallets/new" className={buttonVariants({ size: "lg" })}>
        Create a wallet
      </Link>
    </section>
  );
}
