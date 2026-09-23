import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { TitleBar } from "@/core/shell/title-bar";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { toWalletOptions } from "@/features/transactions/wallet-options";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/transactions/new")({
  head: () => ({ meta: [{ title: "New transaction" }] }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
      context.queryClient.ensureQueryData(transactionQueries.entryDefaults()),
    ]);
  },
  staticData: { form: true },
  component: NewTransactionPage,
});

function NewTransactionPage() {
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  const { data: entryDefaults } = useSuspenseQuery(
    transactionQueries.entryDefaults(),
  );
  if (!walletCollection || !categoryCollection || !entryDefaults) {
    throw new Error("The transaction entry queries returned no data");
  }
  const wallets = toWalletOptions(walletCollection.items);
  const defaultWalletId =
    wallets.find((wallet) => wallet.id === entryDefaults.lastUsedWalletId)
      ?.id ?? wallets[0]?.id;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pb-40 sm:pt-8 sm:pb-12">
      <TitleBar
        title="New transaction"
        actions={
          <Link
            to="/transactions"
            className={buttonVariants({ variant: "ghost" })}
          >
            Cancel
          </Link>
        }
      />
      {defaultWalletId ? (
        <TransactionForm
          wallets={wallets}
          categories={categoryCollection.items}
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
        <WalletIcon aria-hidden="true" strokeWidth={1.75} className="size-5" />
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
        to="/wallets"
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Create or unarchive a wallet
      </Link>
      <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
        Create a wallet
      </Link>
    </section>
  );
}
