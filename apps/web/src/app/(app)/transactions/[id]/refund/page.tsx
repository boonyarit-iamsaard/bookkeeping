import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { listCategories } from "@/features/categories/server/category";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import {
  getExpenseRefunds,
  getTransaction,
} from "@/features/transactions/server/transaction";
import { listWallets } from "@/features/wallets/server/wallet";
import { buttonVariants } from "@/shared/components/ui/button";
import { APP_TIME_ZONE, todayIn } from "@/shared/helpers/dates";
import { formatMoney } from "@/shared/helpers/money";

export const metadata: Metadata = {
  title: "Record refund",
};

export default async function Page({
  params,
}: Readonly<PageProps<"/transactions/[id]/refund">>) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const ownerId = session.user.id;
  const { id } = await params;
  // Ownership is part of the lookup; only a current expense can be refunded.
  const [expense, refunds] = await Promise.all([
    getTransaction(db, { ownerId, id }),
    getExpenseRefunds(db, { ownerId, id }),
  ]);
  if (!expense || !refunds || expense.type !== "expense") {
    notFound();
  }

  const [allWallets, categories] = await Promise.all([
    listWallets(db, { ownerId }),
    listCategories(db, ownerId),
  ]);
  const wallets = allWallets.filter((wallet) => !wallet.archivedAt);
  // The original wallet only while it is active; otherwise the choice stays
  // open rather than silently landing the money somewhere else.
  const defaultWalletId =
    wallets.find((wallet) => wallet.id === expense.wallet.id)?.id ?? "";
  const linked = linkedExpenseView({ expense, refunds });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">Record refund</h1>
        <Link
          href={`/transactions/${expense.id}`}
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
  originalWallet: { id: string; name: string; archived: boolean };
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
        <Wallet aria-hidden="true" strokeWidth={1.75} className="size-5" />
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
          href={`/wallets/${originalWallet.id}`}
          className={buttonVariants({ size: "lg" })}
        >
          Unarchive {originalWallet.name}
        </Link>
      )}
      <Link
        href="/wallets/new"
        className={buttonVariants({
          variant: originalWallet.archived ? "outline" : "default",
          size: "lg",
        })}
      >
        Create a wallet
      </Link>
      <Link
        href={`/transactions/${expenseId}`}
        className={buttonVariants({ variant: "ghost", size: "lg" })}
      >
        Back to the expense
      </Link>
    </section>
  );
}
