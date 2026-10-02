// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";
import { Page } from "@/core/shell/page";
import { BackLink, TitleBar } from "@/core/shell/title-bar";
import { MonthSections } from "@/features/transactions/components/month-sections";
import { historySearchSchema } from "@/features/transactions/history-schema";
import { WalletBalance } from "@/features/wallets/components/wallet-balance";
import { WalletPageErrorBoundary } from "@/features/wallets/components/wallet-page-error-boundary";
import { WalletPageLoading } from "@/features/wallets/components/wallet-page-loading";
import { buttonVariants } from "@/shared/components/ui/button";

/** One wallet's history: the list's own address, pinned to this wallet. */
function walletHistoryQuery(walletId: string, cursor: string | undefined) {
  return transactionQueries.list({ walletId, cursor });
}

export const Route = createFileRoute("/_app/wallets/$walletId")({
  validateSearch: historySearchSchema.pick({ cursor: true, created: true }),
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ context, params, deps }) => {
    const [wallet] = await Promise.all([
      context.queryClient.ensureQueryData(
        walletQueries.detail(params.walletId),
      ),
      context.queryClient.ensureQueryData(
        walletHistoryQuery(params.walletId, deps.cursor),
      ),
      // Rows take their category color from this read.
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
    return { walletName: wallet?.name };
  },
  // After the loader, so its data is typed here.
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.walletName ?? "Wallet" }],
  }),
  pendingComponent: WalletPageLoading,
  errorComponent: WalletPageErrorBoundary,
  component: WalletPage,
});

function WalletPage() {
  const { walletId } = Route.useParams();
  const { cursor, created } = Route.useSearch();
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
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <SlidersHorizontal data-icon="inline-start" strokeWidth={1.75} />
            Manage
          </Link>
        }
      />
      <WalletBalance wallet={wallet} />
      <section
        aria-labelledby="wallet-transactions-heading"
        className="flex flex-col gap-6 sm:gap-8"
      >
        {/* The month headings carry the list visually; this names the region. */}
        <h2 id="wallet-transactions-heading" className="sr-only">
          Transactions
        </h2>
        {page.items.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-muted-foreground text-sm shadow-card sm:p-7">
            No transactions yet
          </p>
        ) : (
          <MonthSections
            transactions={page.items}
            idPrefix="wallet"
            level={3}
            savedId={created}
            pageWalletId={wallet.id}
          />
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
