import type { Query, QueryClient } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";
import { categoryQueries, transactionQueries } from "@/core/api/queries";

const PATH_PREFIXES = ["/v1/transactions", "/v1/wallets", "/v1/reports"];

interface InvalidateTransactionReadsOptions {
  /**
   * A transaction just deleted: its own detail and refunds reads are left
   * out, since re-reading them can only answer not found while their page
   * is still open. `forgetTransactionReads` drops them once it is left.
   */
  deletedTransactionId?: string;
}

function isTransactionRead({ queryKey }: Readonly<Query>): boolean {
  const [path] = queryKey;
  if (typeof path !== "string") {
    return false;
  }
  return (
    path === categoryQueries.usage().queryKey[0] ||
    PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

/** The reads that address one transaction alone. */
function ownReadHashes(transactionId: string): ReadonlySet<string> {
  return new Set([
    hashKey(transactionQueries.detail(transactionId).queryKey),
    hashKey(transactionQueries.refunds(transactionId).queryKey),
  ]);
}

/**
 * Re-reads everything a saved, corrected, or deleted transaction can change:
 * history and detail, an expense's refunds, wallet balances, monthly
 * summaries, and category usage. Keys are the OpenAPI paths, so a prefix
 * covers every list and detail read at once.
 */
export function invalidateTransactionReads(
  queryClient: QueryClient,
  { deletedTransactionId }: Readonly<InvalidateTransactionReadsOptions> = {},
): Promise<void> {
  const excluded =
    deletedTransactionId === undefined
      ? new Set<string>()
      : ownReadHashes(deletedTransactionId);
  return queryClient.invalidateQueries({
    predicate: (query) =>
      isTransactionRead(query) && !excluded.has(query.queryHash),
  });
}

/** Drops a deleted transaction's own reads so a later visit reads not found. */
export function forgetTransactionReads(
  queryClient: QueryClient,
  transactionId: string,
): void {
  const own = ownReadHashes(transactionId);
  queryClient.removeQueries({
    predicate: (query) => own.has(query.queryHash),
  });
}
