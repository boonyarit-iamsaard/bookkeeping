import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/shared/components/ui/button";

interface WalletHistoryProps {
  walletId: string;
  empty: boolean;
  /** The page after this one; none on the last. */
  olderPage: number | undefined;
  /** The transactions, in the composition's own layout. */
  children: React.ReactNode;
}

/** A wallet page's records: the list, or its empty note, then older pages. */
export function WalletHistory({
  walletId,
  empty,
  olderPage,
  children,
}: Readonly<WalletHistoryProps>) {
  return (
    <>
      <section
        aria-labelledby="wallet-transactions-heading"
        className="flex flex-col gap-6 sm:gap-8"
      >
        {/* The month headings carry the list visually; this names the region. */}
        <h2 id="wallet-transactions-heading" className="sr-only">
          Transactions
        </h2>
        {empty ? (
          <p className="bg-card text-muted-foreground shadow-card rounded-2xl p-5 text-sm sm:p-7">
            No transactions yet
          </p>
        ) : (
          children
        )}
      </section>
      {olderPage !== undefined && (
        <Link
          to="/wallets/$walletId"
          params={{ walletId }}
          search={{ page: olderPage }}
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "self-start",
          })}
        >
          Older transactions
        </Link>
      )}
    </>
  );
}
