// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { transactionQueries, walletQueries } from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { historySearchSchema } from "@/features/transactions/history-schema";
import { WalletBalance } from "@/features/wallets/components/wallet-balance";
import { buttonVariants } from "@/shared/components/ui/button";

/** One wallet's history: the list's own address, pinned to this wallet. */
function walletHistoryQuery(walletId: string, cursor: string | undefined) {
  return transactionQueries.list({ walletId, cursor });
}

export const Route = createFileRoute("/_app/wallets/$walletId")({
  head: () => ({ meta: [{ title: "Wallet" }] }),
  validateSearch: historySearchSchema.pick({ cursor: true }),
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: ({ context, params, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        walletQueries.detail(params.walletId),
      ),
      context.queryClient.ensureQueryData(
        walletHistoryQuery(params.walletId, deps.cursor),
      ),
    ]),
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: WalletPage,
});

function WalletPage() {
  const { walletId } = Route.useParams();
  const { cursor } = Route.useSearch();
  const { data: wallet } = useSuspenseQuery(walletQueries.detail(walletId));
  const { data: page } = useSuspenseQuery(walletHistoryQuery(walletId, cursor));
  if (!wallet || !page) {
    throw new Error("The wallet queries returned no data");
  }
  const nextCursor = page.page.nextCursor;

  return (
    <Page layout="wide">
      <TitleBar
        title={wallet.name}
        back={<BackLink to="/wallets" aria-label="Back to Wallets" />}
        actions={
          <Link
            to="/wallets/$walletId/manage"
            params={{ walletId: wallet.id }}
            className={buttonVariants({ variant: "outline" })}
          >
            <SlidersHorizontal data-icon="inline-start" strokeWidth={1.75} />
            Manage
          </Link>
        }
      />
      <WalletBalance wallet={wallet} />
      <section
        aria-labelledby="wallet-transactions-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="wallet-transactions-heading" className="font-semibold text-lg">
          Transactions
        </h2>
        {page.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No transactions yet</p>
        ) : (
          <TransactionList transactions={page.items} />
        )}
      </section>
      {nextCursor && (
        <Link
          to="/wallets/$walletId"
          params={{ walletId: wallet.id }}
          search={{ cursor: nextCursor }}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "self-start",
          })}
        >
          Older transactions
        </Link>
      )}
    </Page>
  );
}
