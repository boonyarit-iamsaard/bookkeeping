import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";

interface NewWalletLinkProps {
  /** Opens New wallet over this screen instead of navigating. */
  onOpen?: () => void;
}

export function NewWalletLink({ onOpen }: Readonly<NewWalletLinkProps>) {
  return (
    <Link
      to="/wallets/new"
      onClick={openInPlace(onOpen)}
      className={buttonVariants({ variant: "outline", size: "lg" })}
    >
      <Plus data-icon="inline-start" />
      New wallet
    </Link>
  );
}
