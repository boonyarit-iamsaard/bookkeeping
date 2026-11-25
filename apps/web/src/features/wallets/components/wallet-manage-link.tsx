import { Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletManageLinkProps {
  walletId: string;
}

export function WalletManageLink({
  walletId,
}: Readonly<WalletManageLinkProps>) {
  return (
    <Link
      to="/wallets/$walletId/manage"
      params={{ walletId }}
      className={buttonVariants({
        variant: "outline",
        size: "lg",
        // Icon-only on phone so a long wallet name keeps the room.
        className:
          "max-sm:w-11 max-sm:px-0 max-sm:has-data-[icon=inline-start]:px-0",
      })}
    >
      <SlidersHorizontal data-icon="inline-start" strokeWidth={1.75} />
      <span className="sr-only sm:not-sr-only">Manage</span>
    </Link>
  );
}
