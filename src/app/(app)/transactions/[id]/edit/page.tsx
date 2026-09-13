import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import {
  initializeDefaultCategories,
  listCategories,
} from "@/features/categories/server/category";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { getTransaction } from "@/features/transactions/server/transaction";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction.types";
import { listWallets } from "@/features/wallets/server/wallet";
import { buttonVariants } from "@/shared/components/ui/button";
import { APP_TIME_ZONE, formatInstant, todayIn } from "@/shared/helpers/dates";
import { formatMoney, formatMoneyInput } from "@/shared/helpers/money";

export const metadata: Metadata = {
  title: "Edit transaction",
};

export default async function Page({
  params,
}: Readonly<PageProps<"/transactions/[id]/edit">>) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const ownerId = session.user.id;
  const { id } = await params;
  // Ownership is part of the lookup: another user's id reads as not found,
  // and so does a deleted transaction.
  const transaction = await getTransaction(db, { ownerId, id });
  if (!transaction) {
    notFound();
  }

  await initializeDefaultCategories(db, ownerId);
  const [wallets, categories] = await Promise.all([
    listWallets(db, { ownerId }),
    listCategories(db, ownerId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">
          Edit {TRANSACTION_TYPE_LABELS[transaction.type].toLowerCase()}
        </h1>
        <Link
          href={`/transactions/${transaction.id}`}
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      <TransactionForm
        wallets={wallets
          .filter(
            (wallet) =>
              !wallet.archivedAt ||
              wallet.id === transaction.wallet.id ||
              wallet.id === transaction.destinationWallet?.id,
          )
          .map((wallet) => ({
            id: wallet.id,
            name: wallet.name,
            type: wallet.type,
            openingDate: wallet.openingDate,
            archived: Boolean(wallet.archivedAt),
            balanceLabel: formatMoney({
              amountInMinorUnits: wallet.balance,
              currency: wallet.currency,
            }),
          }))}
        categories={categories}
        today={todayIn({ timeZone: APP_TIME_ZONE })}
        mode={{
          kind: "edit",
          transaction: {
            id: transaction.id,
            type: transaction.type,
            walletId: transaction.wallet.id,
            categoryId: transaction.category?.id ?? "",
            destinationWalletId: transaction.destinationWallet?.id ?? "",
            amountText: formatMoneyInput({
              amountInMinorUnits: transaction.amount,
              currency: transaction.currency,
            }),
            transactionDate: transaction.transactionDate,
            note: transaction.note,
            recordedLabel: formatInstant({
              instant: transaction.recordedAt,
              timeZone: APP_TIME_ZONE,
            }),
          },
        }}
      />
    </main>
  );
}
