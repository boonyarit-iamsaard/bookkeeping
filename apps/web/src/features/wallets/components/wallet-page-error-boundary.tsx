import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { LoadError } from "@/core/shell/load-error";
import { buttonVariants } from "@/shared/components/ui/button";

/**
 * The wallet page's `errorComponent`. An unknown or deleted wallet lands here
 * too, so Wallets is offered beside Try again.
 */
export function WalletPageErrorBoundary({
  reset,
}: Readonly<ErrorComponentProps>) {
  return (
    <LoadError
      reset={reset}
      title="This wallet could not load"
      message="It may have been deleted, or it could not be reached. Try again, or go back to Wallets. Your saved records are retained."
      actions={
        <Link
          to="/wallets"
          className={buttonVariants({ variant: "outline", size: "touch" })}
        >
          Back to Wallets
        </Link>
      }
    />
  );
}
