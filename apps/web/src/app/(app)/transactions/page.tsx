import { listCategories } from "@bookkeeping/application/categories";
import { listTransactions } from "@bookkeeping/application/transactions";
import { listWallets } from "@bookkeeping/application/wallets";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { HistoryFilters } from "@/features/transactions/components/history-filters";
import { TransactionHistory } from "@/features/transactions/components/transaction-history";
import {
  nonemptySearchParams,
  transactionFiltersSchema,
} from "@/features/transactions/history-schema";
import { buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = {
  title: "Transactions",
};

export default async function Page({
  searchParams,
}: Readonly<PageProps<"/transactions">>) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const values = await searchParams;
  const parsed = transactionFiltersSchema.safeParse(
    nonemptySearchParams(values),
  );
  const [transactions, wallets, categories] = await Promise.all([
    parsed.success
      ? listTransactions(db, { ...parsed.data, ownerId: session.user.id })
      : Promise.resolve([]),
    listWallets(db, { ownerId: session.user.id }),
    listCategories(db, session.user.id),
  ]);
  const savedId = typeof values.saved === "string" ? values.saved : undefined;
  const justDeleted = values.deleted === "1";
  const filtered = ["from", "to", "walletId", "categoryId", "type"].some(
    (key) => Boolean(values[key]),
  );

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
      {justDeleted && (
        <output className="rounded-xl border bg-muted px-4 py-3 text-sm leading-normal">
          <span className="font-medium">Transaction deleted.</span>{" "}
          <span className="text-muted-foreground">
            It no longer counts toward any wallet balance.
          </span>
        </output>
      )}
      <Link
        href="/dashboard"
        className={buttonVariants({
          variant: "outline",
          size: "lg",
          className: "self-start",
        })}
      >
        Monthly summary & balances
      </Link>
      <HistoryFilters
        wallets={wallets}
        categories={categories}
        values={values}
      />
      <TransactionHistory
        transactions={transactions}
        filtersValid={parsed.success}
        filtered={filtered}
        savedId={savedId}
      />
    </main>
  );
}
