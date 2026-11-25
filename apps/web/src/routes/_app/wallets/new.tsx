import { createFileRoute } from "@tanstack/react-router";
import { NewWalletDesktop } from "@/features/wallets/screens/wallet-form.desktop";
import { NewWalletPhone } from "@/features/wallets/screens/wallet-form.phone";
import { useIsDesktop } from "@/shared/hooks/use-is-desktop";

function NewWalletPage() {
  return useIsDesktop() ? <NewWalletDesktop /> : <NewWalletPhone />;
}

export const Route = createFileRoute("/_app/wallets/new")({
  head: () => ({ meta: [{ title: "New wallet" }] }),
  staticData: { form: true },
  component: NewWalletPage,
});
