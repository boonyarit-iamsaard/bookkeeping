import { APP_TIME_ZONE, todayIn } from "@bookkeeping/domain/dates";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { CreateWalletForm } from "@/features/wallets/components/create-wallet-form";
import { buttonVariants } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/wallets/new")({
  head: () => ({ meta: [{ title: "New wallet" }] }),
  staticData: { form: true },
  component: NewWalletPage,
});

function NewWalletPage() {
  return (
    <Page layout="entry">
      <TitleBar
        title="New wallet"
        actions={
          <Link to="/wallets" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        }
      />
      <CreateWalletForm
        defaultOpeningDate={todayIn({ timeZone: APP_TIME_ZONE })}
      />
    </Page>
  );
}
