import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { listTransactions } from "@/features/transactions/server/operations";
import { buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = {
  title: "Transactions",
};

export default async function Page({
  searchParams,
}: PageProps<"/transactions">) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [transactions, { saved }] = await Promise.all([
    listTransactions(db, session.user.id),
    searchParams,
  ]);
  const savedId = typeof saved === "string" ? saved : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">Transactions</h1>
        {transactions.length > 0 && (
          <Link
            href="/transactions/new"
            className={buttonVariants({ size: "lg" })}
          >
            <Plus data-icon="inline-start" />
            Record
          </Link>
        )}
      </div>
      <TransactionList transactions={transactions} savedId={savedId} />
    </main>
  );
}
