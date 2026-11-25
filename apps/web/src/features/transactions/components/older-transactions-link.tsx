import { Link } from "@tanstack/react-router";
import { changeHistoryTable } from "@/features/transactions/history-pages";
import type { HistorySearch } from "@/features/transactions/history-schema";
import { buttonVariants } from "@/shared/components/ui/button";

interface OlderTransactionsLinkProps {
  search: HistorySearch;
  /** The page after this one; none on the last. */
  page: number | undefined;
}

/** The next page of the history, keeping the filters; absent on the last. */
export function OlderTransactionsLink({
  search,
  page,
}: Readonly<OlderTransactionsLinkProps>) {
  if (page === undefined) {
    return null;
  }
  return (
    <Link
      to="/transactions"
      search={changeHistoryTable(search, { page })}
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
