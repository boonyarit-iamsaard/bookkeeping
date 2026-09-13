import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/shared/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="font-semibold text-2xl tracking-tight">
        Welcome to Bookkeeping
      </h1>
      <p className="text-muted-foreground text-sm">
        Start by adding the wallets you want to track.
      </p>
      <div>
        <Link href="/wallets" className={buttonVariants()}>
          Go to wallets
        </Link>
      </div>
    </main>
  );
}
