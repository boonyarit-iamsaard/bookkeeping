import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { isSignedInPathname } from "@/core/router/router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import {
  captureOriginHref,
  captureSearchSchema,
  parseCaptureOrigin,
} from "@/features/transactions/capture-origin";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import {
  resolveDefaultWalletId,
  toWalletOptions,
} from "@/features/transactions/wallet-options";
import { EmptyState } from "@/shared/components/empty-state";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/transactions/new")({
  head: () => ({ meta: [{ title: "New transaction" }] }),
  validateSearch: captureSearchSchema,
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
  const router = useRouter();
  const search = Route.useSearch();
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  const { data: entryDefaults } = useSuspenseQuery(
    transactionQueries.entryDefaults(),
  );
  if (!walletCollection || !categoryCollection || !entryDefaults) {
    throw new Error("The transaction entry queries returned no data");
  }
  const wallets = toWalletOptions(walletCollection.items);
  const captureOrigin = parseCaptureOrigin(search.origin, (pathname) =>
    isSignedInPathname(router, pathname),
  );
  const returnHref = captureOriginHref(captureOrigin);
  const defaultWalletId = resolveDefaultWalletId({
    requestedWalletId: search.wallet,
    lastUsedWalletId: entryDefaults.lastUsedWalletId,
    activeWallets: wallets,
  });

  return (
    <Page layout="entry">
      <TitleBar
        title="New transaction"
        actions={
          // Link requires a typed `to`; the origin is a built path, so a plain
          // anchor navigates in-app and leaves modified clicks to the browser.
          <a
            href={returnHref}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                void router.navigate({ href: returnHref });
              }
            }}
            className={buttonVariants({
              variant: "ghost",
              size: "lg",
              className: "-mr-3",
            })}
          >
            Cancel
          </a>
        }
      />
      {defaultWalletId ? (
        <TransactionForm
          wallets={wallets}
          categories={categoryCollection.items}
          today={todayIn({ timeZone: APP_TIME_ZONE })}
          mode={{ kind: "create", defaultWalletId, captureOrigin }}
        />
      ) : (
        <NoWallet />
      )}
    </Page>
  );
}

function NoWallet() {
  return (
    <EmptyState
      icon={WalletIcon}
      headingId="no-wallet-heading"
      title="No active wallets"
      description="Every transaction belongs to a wallet. Add the cash, bank account, or e-wallet the money moved through, then come back to record it."
      action={
        <>
          <Link
            to="/wallets"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Create or unarchive a wallet
          </Link>
          <Link to="/wallets/new" className={buttonVariants({ size: "lg" })}>
            Create a wallet
          </Link>
        </>
      }
    />
  );
}
