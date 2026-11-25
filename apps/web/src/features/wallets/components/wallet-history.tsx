interface WalletHistoryProps {
  empty: boolean;
  /** The transactions, in the composition's own layout. */
  children: React.ReactNode;
}

/** A wallet page's records: the list or its empty note. */
export function WalletHistory({
  empty,
  children,
}: Readonly<WalletHistoryProps>) {
  return (
    <section
      aria-labelledby="wallet-transactions-heading"
      className="flex flex-col gap-6 sm:gap-8"
    >
      {/* The month headings or the table carry the list visually; this names the region. */}
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
  );
}
