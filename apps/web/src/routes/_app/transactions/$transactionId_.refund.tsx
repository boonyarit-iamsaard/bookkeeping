// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic params must be valid JavaScript identifiers.
import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Wallet as WalletIcon } from "lucide-react";
import type { components } from "@/core/api/openapi.gen";
import {
  categoryQueries,
  transactionQueries,
  walletQueries,
} from "@/core/api/queries";

import { HistoryErrorBoundary } from "@/features/transactions/components/history-error-boundary";
import { HistoryLoading } from "@/features/transactions/components/history-loading";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import { ensureTransaction } from "@/features/transactions/transaction-lookup";
import { toWalletOptions } from "@/features/transactions/wallet-options";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute(
  "/_app/transactions/$transactionId_/refund",
)({
  head: () => ({ meta: [{ title: "Record refund" }] }),
  loader: async ({ context, params }) => {
    const expense = await ensureTransaction(
      context.queryClient,
      params.transactionId,
    );
    if (expense.type !== "expense") {
      throw notFound();
    }
    await Promise.all([
      context.queryClient.ensureQueryData(
        transactionQueries.refunds(params.transactionId),
      ),
      context.queryClient.ensureQueryData(walletQueries.list()),
      context.queryClient.ensureQueryData(categoryQueries.list()),
    ]);
  },
  pendingComponent: HistoryLoading,
  errorComponent: HistoryErrorBoundary,
  component: RefundPage,
});

function RefundPage() {
  const { transactionId } = Route.useParams();
  const { data: expense } = useSuspenseQuery(
    transactionQueries.detail(transactionId),
  );
  const { data: refunds } = useSuspenseQuery(
    transactionQueries.refunds(transactionId),
  );
  const { data: walletCollection } = useSuspenseQuery(walletQueries.list());
  const { data: categoryCollection } = useSuspenseQuery(categoryQueries.list());
  if (!expense || !refunds || !walletCollection || !categoryCollection) {
    throw new Error("The refund entry queries returned no data");
  }
  if (expense.type !== "expense") {
    throw notFound();
  }

  const wallets = toWalletOptions(walletCollection.items);
  const defaultWalletId =
    wallets.find((wallet) => wallet.id === expense.wallet.id)?.id ?? "";
  const linked = linkedExpenseView({ expense, refunds });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">Record refund</h1>
        <Link
          to="/transactions/$transactionId"
          params={{ transactionId: expense.id }}
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      {wallets.length > 0 ? (
        <TransactionForm
          wallets={wallets}
          categories={categoryCollection.items}
          today={todayIn({ timeZone: APP_TIME_ZONE })}
          mode={{ kind: "refund", expense: linked, defaultWalletId }}
        />
      ) : (
        <NoReceivingWallet
          expenseId={expense.id}
          originalWallet={expense.wallet}
        />
      )}
    </main>
  );
}

interface NoReceivingWalletProps {
  expenseId: string;
  originalWallet: components["schemas"]["TransactionWallet"];
}

function NoReceivingWallet({
  expenseId,
  originalWallet,
}: Readonly<NoReceivingWalletProps>) {
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
          A refund lands in an active wallet.{" "}
          {originalWallet.archived
            ? `${originalWallet.name}, the expense’s wallet, is archived: unarchive it, or create another wallet, then record the refund.`
            : "Create a wallet or unarchive one, then record the refund."}
        </p>
      </div>
      {originalWallet.archived && (
        <Link
          to="/wallets/$walletId"
          params={{ walletId: originalWallet.id }}
          className={buttonVariants({ size: "lg" })}
        >
          Unarchive {originalWallet.name}
        </Link>
      )}
      <Link
        to="/wallets/new"
        className={buttonVariants({
          variant: originalWallet.archived ? "outline" : "default",
          size: "lg",
        })}
      >
        Create a wallet
      </Link>
      <Link
        to="/transactions/$transactionId"
        params={{ transactionId: expenseId }}
        className={buttonVariants({ variant: "ghost", size: "lg" })}
      >
        Back to the expense
      </Link>
    </section>
  );
}
