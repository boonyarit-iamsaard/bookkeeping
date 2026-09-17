import { findWallet } from "@bookkeeping/application/wallets";
import { formatMoneyInput } from "@bookkeeping/domain/money";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { WalletManagement } from "@/features/wallets/components/wallet-management";
import { buttonVariants } from "@/shared/components/ui/button";

export default async function Page({
  params,
}: Readonly<PageProps<"/wallets/[id]">>) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const { id } = await params;
  const wallet = await findWallet(db, { ownerId: session.user.id, id });
  if (!wallet) {
    notFound();
  }
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="wrap-break-word min-w-0 font-semibold text-2xl">
          {wallet.name}
        </h1>
        <Link href="/wallets" className={buttonVariants({ variant: "ghost" })}>
          Back
        </Link>
      </div>
      <WalletManagement
        id={wallet.id}
        archived={Boolean(wallet.archivedAt)}
        balance={wallet.balance}
        openingAmount={formatMoneyInput({
          amountInMinorUnits: wallet.openingAmount,
          currency: "THB",
        })}
        openingDate={wallet.openingDate}
      />
    </main>
  );
}
