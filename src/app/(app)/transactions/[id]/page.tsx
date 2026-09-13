import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { TransactionDetailView } from "@/features/transactions/components/transaction-detail";
import { getTransaction } from "@/features/transactions/server/operations";
import { buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = {
  title: "Transaction",
};

export default async function Page({
  params,
}: PageProps<"/transactions/[id]">) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const { id } = await params;
  // Ownership is part of the lookup: another user's id reads as not found.
  const transaction = await getTransaction(db, {
    ownerId: session.user.id,
    id,
  });
  if (!transaction) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">Transaction</h1>
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "ghost" })}
        >
          Back to list
        </Link>
      </div>
      <TransactionDetailView transaction={transaction} />
    </main>
  );
}
