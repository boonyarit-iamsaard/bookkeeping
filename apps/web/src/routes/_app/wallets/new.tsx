import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CreateWalletForm } from "@/features/wallets/components/create-wallet-form";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/wallets/new")({
  head: () => ({ meta: [{ title: "New wallet" }] }),
  component: NewWalletPage,
});

function NewWalletPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-8 pb-40 sm:pb-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl tracking-tight">New wallet</h1>
        <Link
          to="/wallets"
          className={buttonVariants({
            variant: "ghost",
            className: "max-sm:hidden",
          })}
        >
          Cancel
        </Link>
      </div>
      <CreateWalletForm
        defaultOpeningDate={todayIn({ timeZone: APP_TIME_ZONE })}
      />
    </main>
  );
}
