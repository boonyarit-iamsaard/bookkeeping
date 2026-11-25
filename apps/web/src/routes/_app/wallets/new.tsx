import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/core/shell/page";
import { TitleBar } from "@/core/shell/title-bar";
import { WalletFormDesktop } from "@/features/wallets/screens/wallet-form.desktop";
import { WalletFormPhone } from "@/features/wallets/screens/wallet-form.phone";
import { buttonVariants } from "@/shared/components/ui/button";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function NewWalletPage() {
  const desktop = useIsDesktop();

  return (
    <Page layout={desktop ? "column" : "entry"}>
      <TitleBar
        title="New wallet"
        actions={
          // The desktop form's footer carries Cancel.
          !desktop && (
            <Link
              to="/wallets"
              className={buttonVariants({
                variant: "ghost",
                size: "lg",
                className: "-mr-3",
              })}
            >
              Cancel
            </Link>
          )
        }
      />
      {desktop ? <WalletFormDesktop /> : <WalletFormPhone />}
    </Page>
  );
}

export const Route = createFileRoute("/_app/wallets/new")({
  head: () => ({ meta: [{ title: "New wallet" }] }),
  staticData: { form: true },
  component: NewWalletPage,
});
