import { Link } from "@tanstack/react-router";
import type { HistoryFilterValues } from "@/features/transactions/history-schema";
import { buttonVariants } from "@/shared/components/ui/button";

interface OlderTransactionsLinkProps {
  values: HistoryFilterValues;
  cursor: string | null;
}

/** The next page of the history, keeping the filters; absent on the last. */
export function OlderTransactionsLink({
  values,
  cursor,
}: Readonly<OlderTransactionsLinkProps>) {
  if (!cursor) {
    return null;
  }
  return (
    <Link
      to="/transactions"
      search={{ ...values, cursor }}
      className={buttonVariants({
        variant: "outline",
        size: "lg",
        className: "w-full sm:w-auto sm:self-start",
      })}
    >
      Older transactions
    </Link>
  );
}
