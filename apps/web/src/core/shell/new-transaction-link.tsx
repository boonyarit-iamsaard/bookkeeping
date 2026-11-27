import { Link } from "@tanstack/react-router";
import type { CaptureLinkSearch } from "@/core/shell/capture-link-search";
import { buttonVariants } from "@/shared/components/ui/button";
import { openInPlace } from "@/shared/helpers/plain-click";

interface NewTransactionLinkProps {
  captureSearch: CaptureLinkSearch;
  /** Opens New transaction over the current screen instead of navigating. */
  onNewTransaction?: (() => void) | null;
}

/** The desktop's one Iris action, in the top bar or a screen's title row. */
export function NewTransactionLink({
  captureSearch,
  onNewTransaction,
}: Readonly<NewTransactionLinkProps>) {
  return (
    <Link
      to="/transactions/new"
      search={captureSearch}
      onClick={openInPlace(onNewTransaction)}
      className={buttonVariants({ size: "lg" })}
    >
      New transaction
    </Link>
  );
}
