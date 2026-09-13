import type { Metadata } from "next";
import Link from "next/link";
import { CreateWalletForm } from "@/features/wallets/components/create-wallet-form";
import { buttonVariants } from "@/shared/components/ui/button";
import { todayInBangkok } from "@/shared/helpers/dates";

export const metadata: Metadata = {
  title: "New wallet",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">New wallet</h1>
        <Link
          href="/wallets"
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      <CreateWalletForm defaultOpeningDate={todayInBangkok()} />
    </main>
  );
}
