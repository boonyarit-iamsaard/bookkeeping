import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/core/auth/session";
import { db } from "@/core/database/client";
import { WalletList } from "@/features/wallets/components/wallet-list";
import { listWallets } from "@/features/wallets/server/operations";
import { buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = {
  title: "Wallets",
};

export default async function Page({ searchParams }: PageProps<"/wallets">) {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [wallets, { created }] = await Promise.all([
    listWallets(db, session.user.id),
    searchParams,
  ]);
  const createdId = typeof created === "string" ? created : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-semibold text-2xl tracking-tight">Wallets</h1>
        {wallets.length > 0 && (
          <Link href="/wallets/new" className={buttonVariants({ size: "lg" })}>
            <Plus data-icon="inline-start" />
            Create wallet
          </Link>
        )}
      </div>
      <WalletList wallets={wallets} createdId={createdId} />
    </main>
  );
}
