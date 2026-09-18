import { listCategories } from "@bookkeeping/application/categories";
import { listWallets } from "@bookkeeping/application/wallets";
import {
  APP_TIME_ZONE,
  formatInstant,
  todayIn,
} from "@bookkeeping/domain/dates";
import { formatMoney, formatMoneyInput } from "@bookkeeping/domain/money";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { TransactionForm } from "@/features/transactions/components/transaction-form";
import { linkedExpenseView } from "@/features/transactions/linked-expense";
import {
  getExpenseRefunds,
  getTransaction,
} from "@/features/transactions/server/transaction";
import { TRANSACTION_TYPE_LABELS } from "@/features/transactions/transaction-labels";
import { buttonVariants } from "@/shared/components/ui/button";

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

  // A refund shows its expense; an expense shows what it has refunded.
  const refundedExpenseId = transaction.refundOf?.id ?? transaction.id;
  const [wallets, categories, refundedExpense, refunds] = await Promise.all([
    listWallets(db, { ownerId }),
    listCategories(db, ownerId),
    transaction.refundOf
      ? getTransaction(db, { ownerId, id: refundedExpenseId })
      : undefined,
    getExpenseRefunds(db, { ownerId, id: refundedExpenseId }),
  ]);
  const refundOf =
    refundedExpense && refunds
      ? linkedExpenseView({
          expense: refundedExpense,
          refunds,
          editingRefund: transaction,
        })
      : undefined;
  const refundedLabel =
    !transaction.refundOf && refunds && refunds.refunds.length > 0
      ? formatMoney({
          amountInMinorUnits: refunds.refundedTotal,
          currency: transaction.currency,
        })
      : undefined;

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
            // A refund's category is read from its expense, never sent back.
            categoryId: transaction.refundOf
              ? ""
              : (transaction.category?.id ?? ""),
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
            refundOf,
            refundedLabel,
          },
        }}
      />
    </main>
  );
}
